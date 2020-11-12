import { Breadcrumb } from 'antd';
import React, { useEffect, useState } from 'react';

import Link from 'components/Link';
import Section from 'components/Section';
import TrialChart, { Props as TrialChartProps } from 'pages/TrialDetails/TrialChart';
import { ExperimentDetails, RawJson, TrialDetails } from 'types';
import { getPathList } from 'utils/data';

interface Props {
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
  return <Section title={`Trial ${trial.id}`}>
    <Breadcrumb>
      <Breadcrumb.Item>
        <Link path={`/experiments/${experiment.id}`}>Experiment {experiment.id}</Link>
      </Breadcrumb.Item>
      <Breadcrumb.Item>
        <Link path={`/trials/${trial.id}`}>Trial {trial.id}</Link>
      </Breadcrumb.Item>
    </Breadcrumb>

    <p>stats</p>
    {configRenderer(experiment.configRaw, p.configPath)}
    <p> of config</p>
    <TrialChart steps={trial.steps} {...p.trialChartProps} />

  </Section>;
};

export default TrialCard;
