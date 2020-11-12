import { Space } from 'antd';
import React, { useEffect, useState } from 'react';

import Logo, { LogoTypes } from 'components/Logo';
import Page from 'components/Page';
import Spinner from 'components/Spinner';
import TaskCard from 'components/TaskCard';
import TrialCard from 'components/TrialCard';
import { getExperimentDetails, getTrialDetails } from 'services/api';
import { ExperimentDetails, MetricType, TrialDetails } from 'types';
import { experimentDetailsToTask } from 'utils/types';

import css from './Report.module.scss';

type Data = Record<number, ExperimentDetails>;
type TrialData = Record<number, TrialDetails>;

const targetExps = [ 3, 2, 4, 5, 6, 7, 8 ];
const targetTrials = [ 3, 2, 4, 5, 6, 7, 8 ];

const Report: React.FC = () => {
  const [ expDetails, setExpDetails ] = useState<Data>({});
  const [ trialDetails, setTrialDetails ] = useState<TrialData>({});

  // fetch initial data.
  useEffect(() => {
    Promise.all(targetExps.map(expId => getExperimentDetails({ id: expId })))
      .then(details => {
        const newExpDetails = details.reduce((acc: Data, cur: ExperimentDetails) => {
          acc[cur.id] = cur;
          return acc;
        }, {});
        setExpDetails(newExpDetails);
      }).catch(console.error);

    Promise.all(targetTrials.map(expId => getTrialDetails({ id: expId })))
      .then(details => {
        const newTrialDetails = details.reduce((acc: TrialData, cur: TrialDetails) => {
          acc[cur.id] = cur;
          return acc;
        }, {});
        setTrialDetails(newTrialDetails);
      }).catch(console.error);
  }, [ setExpDetails, setTrialDetails ]);

  const exp0 = expDetails[targetExps[0]]; // exp with index 0 in targetExps
  const trial0 = trialDetails[targetTrials[0]];

  if (!exp0 || !trial0) return <Spinner />;

  return (
    <Page
      className={css.base}
      options={<span>Powered by <Logo type={LogoTypes.OnLightHorizontal} /></span>}
      showDivider
      subTitle={<Space align="center" size="small">by Shiyuan Zhu</Space>}
      title="Training CycleGAN using Determined">
      <div className={css.readme}>
        <p>CycleGAN is a technique that can be used to do image-to-image translation. In this report, I've outlined how I trained CycleGAN using Determined.</p>
        <p>First, I trained the experiment with one GPU to sanity check the experiment runs well.</p>
        <TrialCard
          configPath={[ [ 'searcher' ] ]}
          experiment={exp0}
          trial={trial0}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
      </div>

      <div className={css.readme}>
        <p>Then, I used distributed training on 64 GPUs:</p>
        <TrialCard
          experiment={expDetails[targetExps[1]]}
          trial={trialDetails[targetTrials[1]]}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
        <p>The training throughput varies from 71 to 164 records per second, which is very unstable.</p>
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>To locate the issue, I set aggregation_frequency to be a very large number to check if it is because of network communication.</p>
        <TrialCard
          experiment={expDetails[targetExps[2]]}
          trial={trialDetails[targetTrials[2]]}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
        <p>The throughput is much more stable this way. Now, I can change the other fields to see the effect on throughput.</p>
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>Setting the global batch size to 256 and aggregation_frequency to 1:</p>
        <TrialCard
          configPath={[ [ 'hyperparameters', 'global_batch_size' ], [ 'optimizations', 'aggregation_frequency' ] ]}
          experiment={expDetails[targetExps[3]]}
          trial={trialDetails[targetTrials[3]]}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>Setting the global batch size to 128 and aggregation_frequency to 1:</p>
        <TrialCard
          configPath={[ [ 'hyperparameters', 'global_batch_size' ], [ 'optimizations', 'aggregation_frequency' ] ]}
          experiment={expDetails[targetExps[4]]}
          trial={trialDetails[targetTrials[4]]}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>Setting the global batch size to 64 and aggregation_frequency to 2:</p>
        <TrialCard
          configPath={[ [ 'hyperparameters', 'global_batch_size' ], [ 'optimizations', 'aggregation_frequency' ] ]}
          experiment={expDetails[targetExps[5]]}
          trial={trialDetails[targetTrials[5]]}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>Setting the global batch size to 128 and aggregation_frequency to 1:</p>
        <TrialCard
          configPath={[ [ 'hyperparameters', 'global_batch_size' ], [ 'optimizations', 'aggregation_frequency' ] ]}
          experiment={expDetails[targetExps[6]]}
          trial={trialDetails[targetTrials[6]]}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>Setting the global batch size to 64 and aggregation_frequency to 2:</p>
        <TrialCard
          configPath={[ [ 'hyperparameters', 'global_batch_size' ], [ 'optimizations', 'aggregation_frequency' ] ]}
          experiment={expDetails[targetExps[7]]}
          trial={trialDetails[targetTrials[7]]}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>Setting the global batch size to 64 and aggregation_frequency to 4:</p>
        <TrialCard
          configPath={[ [ 'hyperparameters', 'global_batch_size' ], [ 'optimizations', 'aggregation_frequency' ] ]}
          experiment={expDetails[targetExps[8]]}
          trial={trialDetails[targetTrials[8]]}
          trialChartProps={{
            defaultMetricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
            metricNames: [ { name: 'loss_cycle', type: MetricType.Training } ],
          }} />
      </div>
      {/* next comp/image */}

    </Page>
  );
};

export default Report;
