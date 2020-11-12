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

const targetExps = [ 10, 2 ];
const targetTrials = [ 10 ];

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
      <p>CycleGAN is a technique that can be used to do image-to-image translation. In this report, I've outlined how I trained CycleGAN using Determined.</p>
      <p>The first step is to try to optimize for the maximum batch size, which I did in this experiment:</p>
      <p>{exp0?.state}</p>
      <TaskCard {...experimentDetailsToTask(exp0)}
      />

      <div className={css.readme}>
        <p>next message</p>
      </div>
      <TrialCard
        configPath={[ 'searcher' ]}
        experiment={exp0}
        trial={trial0}
        trialChartProps={{
          defaultMetricNames: [ { name: 'validation_error', type: MetricType.Validation } ],
          metricNames: [ { name: 'validation_error', type: MetricType.Validation } ],
        }} />

      <div className={css.readme}>
        <p>next message</p>
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>next message</p>
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>next message</p>
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>next message</p>
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>next message</p>
      </div>
      {/* next comp/image */}

      <div className={css.readme}>
        <p>next message</p>
      </div>
      {/* next comp/image */}

    </Page>
  );
};

export default Report;
