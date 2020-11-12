import { Space } from 'antd';
import React, { useEffect, useState } from 'react';

import Page from 'components/Page';
import Spinner from 'components/Spinner';
import TaskCard from 'components/TaskCard';
import TrialCard from 'components/TrialCard';
import { getExperimentDetails } from 'services/api';
import { ExperimentDetails, TrialDetails } from 'types';
import { experimentDetailsToTask } from 'utils/types';

import css from './Report.module.scss';

type Data = Record<number, ExperimentDetails>;

const targetExps = [ 1,2 ];

const Report: React.FC = () => {
  const [ expDetails, setExpDetails ] = useState<Data>({});

  useEffect(() => {
    Promise.all(targetExps.map(expId => getExperimentDetails({ id: expId })))
      .then(details => {
        const newExpDetails = details.reduce((acc: Data, cur: ExperimentDetails) => {
          acc[cur.id] = cur;
          return acc;
        }, {});
        setExpDetails(newExpDetails);
      }).catch(console.error);
  }, [ setExpDetails ]);

  const exp1 = expDetails[targetExps[0]];

  if (!exp1) return <Spinner />;

  return (
    <Page
      className={css.base}
      subTitle={<Space align="center" size="small">by Shiyuan Zhu</Space>}
      title="Training CycleGAN using Determined">
      <p>CycleGAN is a technique that can be used to do image-to-image translation. In this report, I've outlined how I trained CycleGAN using Determined.</p>
      <p>The first step is to try to optimize for the maximum batch size, which I did in this experiment:</p>
      <p>{exp1?.state}</p>
      <TaskCard {...experimentDetailsToTask(exp1)}
      />

      <div className={css.readme}>
        <p>next message</p>
      </div>
      <TrialCard configPath={[ 'hyperparameters' ]} experiment={exp1} trial={{ id: 1 } as TrialDetails} />

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
