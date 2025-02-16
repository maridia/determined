import logging
from typing import Any, Callable, Dict, Iterator, List, Optional, Set, Tuple, Type, Union

import torch
import torch.nn as nn

import determined as det
from determined import pytorch
from determined.horovod import hvd
from determined_common import check

# Apex is included only for GPU trials.
try:
    import apex
except ImportError:
    if torch.cuda.is_available():
        logging.warning("Failed to import apex.")
    pass


class PyTorchTrialContext(det.TrialContext):
    """Contains runtime information for any Determined workflow that uses the ``PyTorch`` API.

    With this class, users can do the following things:

    1. Wrap PyTorch models, optimizers, and LR schedulers with their Determined-compatible
       counterparts using :meth:`wrap_model`, :meth:`wrap_optimizer`, :meth:`wrap_lr_scheduler`,
       respectively. The Determined-compatible objects are capable of transparent
       distributed training, checkpointing and exporting, mixed-precision training,
       and gradient aggregation.
    2. Configure apex amp by calling :meth:`configure_apex_amp` (optional).
    3. Calculate the gradients with :meth:`backward` on a specified loss.
    4. Run an optimization step with :meth:`step_optimizer`.
    5. Functionalities inherited from :class:`determined.TrialContext`, including getting
       the runtime information and properly handling training data in distributed training.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        self._init_device()

        # Track which types we have issued warnings for in to_device().
        self._to_device_warned_types = set()  # type: Set[Type]

        # The following attributes are initialized during the lifetime of
        # a PyTorchTrialContext.
        self.models = []  # type: List[nn.Module]
        self.optimizers = []  # type: List[torch.optim.Optimizer] #  type: ignore
        self.lr_schedulers = []  # type: List[pytorch.LRScheduler]
        self._epoch_len = None  # type: Optional[int]

        # Use a main model to contain all of the models because when using horovod
        # to broadcast the states of models we want to avoid name conflicts for these
        # states so we set all the models to be sub-module of the main model with
        # different names using __setattr__ and use the state_dict of the main model
        # for broadcasting. Note that broadcast_parameters only accepts state_dict()
        # although its doc says it also accepts named_parameters()
        self._main_model = nn.Module()  # type: nn.Module
        self._use_amp = False
        self._loss_ids = {}  # type: Dict[torch.Tensor, int]
        self._last_backward_batch_idx = None  # type: Optional[int]
        self._current_batch_idx = None  # type: Optional[int]

        self.experimental = pytorch.PyTorchExperimentalContext()

    def get_model(self) -> torch.nn.Module:
        """
        Get the model associated with the trial. This function should not be
        called from:

            * ``__init__``
            * ``build_model()``

        .. warning::
            This is deprecated.
        """
        # TODO(DET-3262): remove this backward compatibility of old interface.
        logging.warning(
            "PyTorchTrialContext.get_model is deprecated. "
            "Please directly use the model wrapped by context.wrap_model()."
        )
        check.len_eq(self.models, 1)
        return self.models[0]

    def get_optimizer(self) -> torch.optim.Optimizer:  # type: ignore
        """
        Get the optimizer associated with the trial. This function should not be
        called from:

            * ``__init__``
            * ``build_model()``
            * ``optimizer()``


        .. warning::
            This is deprecated.
        """
        # TODO(DET-3262): remove this backward compatibility of old interface.
        logging.warning(
            "PyTorchTrialContext.get_optimizer is deprecated. "
            "Please directly use the model wrapped by context.wrap_optimizer()."
        )
        check.len_eq(self.optimizers, 1)
        return self.optimizers[0]

    def get_lr_scheduler(self) -> Optional[pytorch.LRScheduler]:
        """
        Get the scheduler associated with the trial, if one is defined. This
        function should not be called from:

            * ``__init__``
            * ``build_model()``
            * ``optimizer()``
            * ``create_lr_scheduler()``

        .. warning::
            This is deprecated.
        """
        # TODO(DET-3262): remove this backward compatibility of old interface.
        logging.warning(
            "PyTorchTrialContext.get_lr_scheduler is deprecated. "
            "Please directly use the model wrapped by context.wrap_lr_scheduler()."
        )
        check.lt_eq(len(self.lr_schedulers), 1)
        if len(self.lr_schedulers) == 1:
            return self.lr_schedulers[0]
        return None

    def wrap_model(self, model: torch.nn.Module) -> torch.nn.Module:
        """Returns a wrapped model."""

        if self.env.managed_training:
            check.false(self._use_amp, "Must call wrap_model() before configure_apex_amp.")

            model = model.to(self.device)
            if not self.hvd_config.use and self.n_gpus > 1:
                check.eq(
                    self.hvd_config.aggregation_frequency,
                    1,
                    "Please enable `optimized_parallel` to use aggregation "
                    "frequency greater than 1 for single machine multi-GPU "
                    "training.",
                )
                model = nn.DataParallel(model)
                logging.debug("Initialized model for native parallel training.")

        model_id = len(self.models)
        self._main_model.__setattr__(f"model_{model_id}", model)

        self.models.append(model)
        return model

    def wrap_optimizer(
        self,
        optimizer: torch.optim.Optimizer,  # type: ignore
        backward_passes_per_step: int = 1,
    ) -> torch.optim.Optimizer:  # type: ignore
        """Returns a wrapped optimizer.

        The optimizer must use the models wrapped by :meth:`wrap_model`. This function
        creates a ``horovod.DistributedOptimizer`` if using parallel/distributed training.

        `backward_passes_per_step` can be used to specify how many gradient aggregation
        steps will be performed in a single `train_batch` call per optimizer step.
        In most cases, this will just be the default value 1.  However, this advanced functionality
        can be used to support training loops like the one shown below:

        .. code-block:: python

            def train_batch(
                self, batch: TorchData, epoch_idx: int, batch_idx: int
            ) -> Dict[str, torch.Tensor]:
                data, labels = batch
                output = self.model(data)
                loss1 = output['loss1']
                loss2 = output['loss2']
                self.context.backward(loss1)
                self.context.backward(loss2)
                self.context.step_optimizer(self.optimizer, backward_passes_per_step=2)
                return {"loss1": loss1, "loss2": loss2}

        """
        if self.env.managed_training:
            check.false(self._use_amp, "Must call wrap_optimizer() before configure_apex_amp.")
            check.gt_eq(
                backward_passes_per_step,
                1,
                "backwar_passes_per_step for local gradient aggregation must be >= 1",
            )

            if self.hvd_config.use:
                use_compression = self.hvd_config.fp16_compression
                optimizer = hvd.DistributedOptimizer(
                    optimizer,
                    named_parameters=self._filter_named_parameters(optimizer),
                    backward_passes_per_step=backward_passes_per_step
                    * self.hvd_config.aggregation_frequency,
                    compression=hvd.Compression.fp16 if use_compression else hvd.Compression.none,
                )
                logging.debug(
                    "Initialized optimizer for distributed and optimized parallel training."
                )

        self.optimizers.append(optimizer)
        return optimizer

    def wrap_lr_scheduler(
        self,
        lr_scheduler: torch.optim.lr_scheduler._LRScheduler,
        step_mode: pytorch.LRScheduler.StepMode,
    ) -> torch.optim.lr_scheduler._LRScheduler:
        """Returns a wrapped LR scheduler.

        The LR scheduler must use an optimizer wrapped by :meth:`wrap_optimizer`.  If ``apex.amp``
        is in use, the optimizer must also have been configured with :meth:`configure_apex_amp`.
        """
        opt = getattr(lr_scheduler, "optimizer", None)
        if opt is not None:
            check.is_in(
                opt,
                self.optimizers,
                "Must use an optimizer that is returned by wrap_optimizer()",
            )
        wrapped = pytorch.LRScheduler(lr_scheduler, step_mode)
        self.lr_schedulers.append(wrapped)

        # Return the original LR scheduler to the user in case they have customizations that we
        # don't care about.
        return lr_scheduler

    def _filter_named_parameters(self, optimizer: torch.optim.Optimizer) -> List:  # type: ignore
        """_filter_named_parameters filters the named parameters of a specified optimizer out
        of all the named parameters from a specified model. We need this function because
        a ``torch.optim.Optimizer`` doesn't store parameter names and we need the names of
        the parameters when mapping parameters to each ``horovod.DistributedOptimizer``.
        """
        opt_params = {p for group in optimizer.param_groups for p in group.get("params", [])}
        return [(name, p) for name, p in self._main_model.named_parameters() if p in opt_params]

    def _init_device(self) -> None:
        self.n_gpus = len(self.env.container_gpus)
        if self.hvd_config.use:
            check.gt(self.n_gpus, 0)
            # We launch a horovod process per GPU. Each process
            # needs to bind to a unique GPU.
            self.device = torch.device(hvd.local_rank())
            torch.cuda.set_device(self.device)
        elif self.n_gpus > 0:
            self.device = torch.device("cuda", 0)
        else:
            self.device = torch.device("cpu")
        check.is_not_none(self.device)

    def to_device(self, data: pytorch._Data) -> pytorch.TorchData:
        """Map generated data to the device allocated by the Determined cluster.

        All the data in the data loader and the models are automatically moved to the
        allocated device. This method aims at providing a function for the data generated
        on the fly.
        """
        return pytorch.to_device(data, self.device, self._to_device_warned_types)

    def configure_apex_amp(
        self,
        models: Union[torch.nn.Module, List[torch.nn.Module]],
        optimizers: Union[torch.optim.Optimizer, List[torch.optim.Optimizer]],  # type: ignore
        enabled: Optional[bool] = True,
        opt_level: Optional[str] = "O1",
        cast_model_type: Optional[torch.dtype] = None,
        patch_torch_functions: Optional[bool] = None,
        keep_batchnorm_fp32: Optional[Union[bool, str]] = None,
        master_weights: Optional[bool] = None,
        loss_scale: Optional[Union[float, str]] = None,
        cast_model_outputs: Optional[torch.dtype] = None,
        num_losses: Optional[int] = 1,
        verbosity: Optional[int] = 1,
        min_loss_scale: Optional[float] = None,
        max_loss_scale: Optional[float] = 2.0 ** 24,
    ) -> Tuple:
        """
        Configure automatic mixed precision for your models and optimizers. Note that details
        for apex.amp are handled automatically within Determined after this call.

        This function must be called **after** you have finished constructing your models and
        optimizers with :meth:`wrap_model` and :meth:`wrap_optimizer`.

        This function has the same arguments as
        `apex.amp.initialize <https://nvidia.github.io/apex/amp.html#apex.amp.initialize>`_.

        .. warning::
            When using distributed training and automatic mixed precision,
            we only support ``num_losses=1`` and calling backward on the loss once.

        Arguments:
            models (``torch.nn.Module`` or list of ``torch.nn.Module`` s):  Model(s) to modify/cast.
            optimizers (``torch.optim.Optimizer`` or list of ``torch.optim.Optimizer`` s):
                Optimizers to modify/cast. REQUIRED for training.
            enabled (bool, optional, default=True):  If False, renders all Amp calls no-ops,
                so your script should run as if Amp were not present.
            opt_level (str, optional, default="O1"):  Pure or mixed precision optimization level.
                Accepted values are "O0", "O1", "O2", and "O3", explained in detail above.
            cast_model_type (``torch.dtype``, optional, default=None):  Optional property override,
                see above.
            patch_torch_functions (bool, optional, default=None):  Optional property override.
            keep_batchnorm_fp32 (bool or str, optional, default=None):  Optional property override.
                If passed as a string, must be the string "True" or "False".
            master_weights (bool, optional, default=None):  Optional property override.
            loss_scale (float or str, optional, default=None):  Optional property override.
                If passed as a string, must be a string representing a number, e.g., "128.0",
                or the string "dynamic".
            cast_model_outputs (torch.dtype, optional, default=None):  Option to ensure that
                the outputs of your model is always cast to a particular type regardless of
                ``opt_level``.
            num_losses (int, optional, default=1):  Option to tell Amp in advance how many
                losses/backward passes you plan to use.  When used in conjunction with the
                ``loss_id`` argument to ``amp.scale_loss``, enables Amp to use a different
                loss scale per loss/backward pass, which can improve stability.
                If ``num_losses`` is left to 1, Amp will still support multiple losses/backward
                passes, but use a single global loss scale for all of them.
            verbosity (int, default=1):  Set to 0 to suppress Amp-related output.
            min_loss_scale (float, default=None):  Sets a floor for the loss scale values that
                can be chosen by dynamic loss scaling.  The default value of None means that no
                floor is imposed. If dynamic loss scaling is not used, `min_loss_scale` is ignored.
            max_loss_scale (float, default=2.**24):  Sets a ceiling for the loss scale values
                that can be chosen by dynamic loss scaling.  If dynamic loss scaling is not used,
                `max_loss_scale` is ignored.

        Returns:
            Model(s) and optimizer(s) modified according to the ``opt_level``.
            If  ``optimizers`` args were lists, the corresponding return value will
            also be a list.
        """
        if not self.env.managed_training:
            return models, optimizers

        check.false(self._use_amp, "Please only call configure_apex_amp once.")
        if self.hvd_config.use:
            check.eq(
                num_losses,
                1,
                "When using parallel/distributed training, "
                "Determined only supports configure_apex_amp with num_losses = 1",
            )

        self._use_amp = True

        if self.hvd_config.use:
            check.eq(
                self.hvd_config.aggregation_frequency,
                1,
                "Mixed precision training (AMP) is not supported with "
                "aggregation frequency > 1.",
            )

        check.true(
            torch.cuda.is_available(),
            "Mixed precision training (AMP) is supported only on GPU slots.",
        )

        logging.info(f"Enabling mixed precision training with opt_level: {opt_level}.")
        models, optimizers = apex.amp.initialize(
            models=models,
            optimizers=optimizers,
            enabled=enabled,
            opt_level=opt_level,
            cast_model_type=cast_model_type,
            patch_torch_functions=patch_torch_functions,
            keep_batchnorm_fp32=keep_batchnorm_fp32,
            master_weights=master_weights,
            loss_scale=loss_scale,
            cast_model_outputs=cast_model_outputs,
            num_losses=num_losses,
            min_loss_scale=min_loss_scale,
            max_loss_scale=max_loss_scale,
            verbosity=verbosity
            if self.distributed.get_rank() == 0 or self.env.experiment_config.debug_enabled()
            else 0,
        )
        if not isinstance(models, list):
            self.models = [models]
        if not isinstance(optimizers, list):
            self.optimizers = [optimizers]
        return models, optimizers

    def _should_communicate_and_update(self) -> bool:
        if not self.env.managed_training:
            return True
        if self._current_batch_idx is None:
            raise det.errors.InternalException("Training hasn't started.")
        return (self._current_batch_idx + 1) % self.hvd_config.aggregation_frequency == 0

    def backward(
        self,
        loss: torch.Tensor,
        gradient: Optional[torch.Tensor] = None,
        retain_graph: bool = False,
        create_graph: bool = False,
    ) -> None:
        """Compute the gradient of current tensor w.r.t. graph leaves.

        The arguments are used in the same way as ``torch.Tensor.backward``.
        See https://pytorch.org/docs/1.4.0/_modules/torch/tensor.html#Tensor.backward for details.

        .. warning::
            When using distributed training, we don't support manual gradient accumulation.
            That means the gradient on each parameter can only be calculated once on each batch.
            If a parameter is associated with multiple losses, you can either choose to call
            backward on only one of those losses or you could set ``require_grads`` flag of a
            parameter or module to false to avoid manual gradient accumulation on that parameter.
            However, you can do gradient accumulation across batches by setting
            :ref:`optimizations.aggregation_frequency <config-aggregation-frequency>` in the
            experiment configuration to be greater than 1.

        Arguments:
            gradient (Tensor or None): Gradient w.r.t. the
                tensor. If it is a tensor, it will be automatically converted
                to a Tensor that does not require grad unless ``create_graph`` is True.
                None values can be specified for scalar Tensors or ones that
                don't require grad. If a None value would be acceptable then
                this argument is optional.
            retain_graph (bool, optional): If ``False``, the graph used to compute
                the grads will be freed. Note that in nearly all cases setting
                this option to True is not needed and often can be worked around
                in a much more efficient way. Defaults to the value of
                ``create_graph``.
            create_graph (bool, optional): If ``True``, graph of the derivative will
                be constructed, allowing to compute higher order derivative
                products. Defaults to ``False``.
        """
        if self._use_amp:
            if (
                self._last_backward_batch_idx is None
                or self._current_batch_idx is None
                or self._last_backward_batch_idx < self._current_batch_idx
            ):
                self._last_backward_batch_idx = self._current_batch_idx
            else:
                raise det.errors.InvalidExperimentException(
                    "Calling context.backward(loss) multiple times is not supported "
                    "while using apex.amp and parallel/distributed training"
                )

            if loss not in self._loss_ids:
                self._loss_ids[loss] = len(self._loss_ids)
            with apex.amp.scale_loss(
                loss, self.optimizers, loss_id=self._loss_ids[loss]
            ) as scaled_loss:
                scaled_loss.backward(
                    gradient=gradient, retain_graph=retain_graph, create_graph=create_graph
                )

                if self.hvd_config.use and self._should_communicate_and_update():
                    # When we exit out of this context manager, we need to finish
                    # communicating gradient updates before they are unscaled.
                    #
                    # Unfortunately, there is no clean way to support unscaling
                    # happening after synchronizing the optimizer on apex.amp.
                    # A short-term solution is to not support multiple losses nor
                    # multiple backward passes on one loss. A long-term solution is
                    # to integrate torch native AMP (https://pytorch.org/docs/stable/amp.html),
                    # which will come out soon.
                    for optimizer in self.optimizers:
                        optimizer.synchronize()
        else:
            loss.backward(  # type: ignore
                gradient=gradient,
                retain_graph=retain_graph,
                create_graph=create_graph,
            )

    def _average_gradients(self, parameters: Any, divisor: int) -> None:
        check.gt_eq(divisor, 1)
        if divisor == 1:
            return

        divisor_value = float(divisor)
        for p in filter(lambda param: param.grad is not None, parameters):
            p.grad.data.div_(divisor_value)

    def step_optimizer(
        self,
        optimizer: torch.optim.Optimizer,  # type: ignore
        clip_grads: Optional[Callable[[Iterator], None]] = None,
        auto_zero_grads: bool = True,
    ) -> None:
        """
        Perform a single optimization step.

        This function must be called once for each optimizer. However, the order of
        different optimizers' steps can be specified by calling this function in different
        orders. Also, gradient accumulation across iterations is performed by the Determined
        training loop by setting the experiment configuration field
        :ref:`optimizations.aggregation_frequency <config-aggregation-frequency>`.

        Here is a code example:

        .. code-block:: python

            def clip_grads(params):
                torch.nn.utils.clip_grad_norm_(params, 0.0001),

            self.context.step_optimizer(self.opt1, clip_grads)

        Arguments:
            optimizer(``torch.optim.Optimizer``): Which optimizer should be stepped.
            clip_grads(a function, optional): This function should have one argument for
                parameters in order to clip the gradients.
            auto_zero_grads(bool, optional): Automatically zero out gradients automatically after
                stepping the optimizer. If false, you need to call ``optimizer.zero_grad()``
                manually. Note that if :ref:`optimizations.aggregation_frequency
                <config-aggregation-frequency>` is greater than 1, ``auto_zero_grads`` must be true.
        """

        check.true(
            auto_zero_grads or self.hvd_config.aggregation_frequency > 1,
            "if optimizations.aggregation_frequency is larger than 1, "
            "you can only set auto_zero_grads to be true. ",
        )
        if self._should_communicate_and_update():
            # Communication needs to be synchronized so that is completed
            # before we apply gradient clipping and `step()`.
            if self.hvd_config.use and not self._use_amp:
                optimizer.synchronize()

            parameters = (
                [p for group in optimizer.param_groups for p in group.get("params", [])]
                if not self._use_amp
                else apex.amp.master_params(optimizer)
            )

            if self.hvd_config.average_aggregated_gradients:
                self._average_gradients(
                    parameters=parameters, divisor=self.hvd_config.aggregation_frequency
                )

            if clip_grads is not None:
                clip_grads(parameters)

            if self.hvd_config.use:
                with optimizer.skip_synchronize():
                    optimizer.step()
            else:
                optimizer.step()

            if auto_zero_grads:
                optimizer.zero_grad()

    def is_epoch_start(self) -> bool:
        """
        Returns true if the current batch is the first batch of the epoch.

        .. warning::
            Not accurate for variable size epochs.
        """
        if self._current_batch_idx is None:
            raise det.errors.InternalException("Training hasn't started.")
        if self._epoch_len is None:
            raise det.errors.InternalException("Training DataLoader uninitialized.")
        return self._current_batch_idx % self._epoch_len == 0

    def is_epoch_end(self) -> bool:
        """
        Returns true if the current batch is the last batch of the epoch.

        .. warning::
            Not accurate for variable size epochs.
        """
        if self._current_batch_idx is None:
            raise det.errors.InternalException("Training hasn't started.")
        if self._epoch_len is None:
            raise det.errors.InternalException("Training DataLoader uninitialized.")
        return self._current_batch_idx % self._epoch_len == self._epoch_len - 1
