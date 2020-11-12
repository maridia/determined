import { Breadcrumb } from 'antd';
import React, { useMemo } from 'react';

import Link from 'components/Link';
import Section from 'components/Section';
import TrialChart, { Props as TrialChartProps } from 'pages/TrialDetails/TrialChart';
import TrialInfoBox from 'pages/TrialDetails/TrialInfoBox';
import { ExperimentDetails, RawJson, TrialDetails } from 'types';
import { getPathList } from 'utils/data';
import { shortEnglishHumannizer } from 'utils/time';
import { trialDurations } from 'utils/types';

import css from './TrialCard.module.scss';

interface Props {
  title?: string;
  trial: TrialDetails;
  configPath?: string[]; // path to the intereseting part of config
  trialChartProps: TrialChartProps;
  experiment: ExperimentDetails;
}

const configRenderer = (conf: RawJson, path?: string[]) => {
  // TODO maybe use monaco editor in readonly mode
  const subConf = path && path.length ? getPathList(conf, path) : conf;
  return <pre>{JSON.stringify(subConf, null, 2)}</pre>;
};

const TrialCard: React.FC<Props> = ({ trial, experiment, ...p }: Props) => {
  const durations = useMemo(() => trialDurations(trial.steps), [ trial.steps ]);

  return <Section bodyBorder title={p.title || `Trial ${trial.id} Card`}>
    <Breadcrumb>
      <Breadcrumb.Item>
        <Link path={`/experiments/${experiment.id}`}>Experiment {experiment.id}</Link>
      </Breadcrumb.Item>
      <Breadcrumb.Item>
        <Link path={`/trials/${trial.id}`}>Trial {trial.id}</Link>
      </Breadcrumb.Item>
    </Breadcrumb>

    <p>config</p>
    {configRenderer(experiment.configRaw, p.configPath)}
    <TrialChart steps={trial.steps} {...p.trialChartProps} />
    <p>stats</p>
    <p>experiment launched {experiment.trials.length} trials</p>

    {/* <TrialInfoBox experiment={experiment} trial={trial} /> */}

    <p>Durations</p>
    <div className={css.duration}>
      <div>Training: {shortEnglishHumannizer(durations.train)}</div>
      <div>Checkpointing: {shortEnglishHumannizer(durations.checkpoint)}</div>
      <div>Validating: {shortEnglishHumannizer(durations.validation)}</div>
    </div>,

  </Section>;
};

export default TrialCard;
