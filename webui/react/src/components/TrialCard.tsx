import { Breadcrumb } from 'antd';
import React, { useEffect, useState } from 'react';

import Link from 'components/Link';
import Section from 'components/Section';
import { ExperimentDetails, TrialDetails } from 'types';

interface Props {
  trial: TrialDetails;
  experiment: ExperimentDetails;
}

const TrialCard: React.FC<Props> = ({ trial, experiment }: Props) => {
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
    <pre>{JSON.stringify(experiment.configRaw, null, 2)}</pre>
    <p> of config</p>

  </Section>;
};

export default TrialCard;
