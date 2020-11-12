import React, { useEffect, useState } from 'react';

import Message, { MessageType } from 'components/Message';
import Page from 'components/Page';
import { getExperimentDetails } from 'services/api';
import { ExperimentDetails } from 'types';

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

  const msg = 'set the remote server: `dev.setServerAddress(ADDRESS)`';
  return (
    <Page className={css.base} title="Report">
      <p>Hello</p>
      <p>first exp state: {expDetails[targetExps[0]]?.state}</p>
      <p>second exp startTime {expDetails[targetExps[1]]?.startTime}</p>
      <Message message={msg} title="msg" type={MessageType.Empty} />
    </Page>
  );
};

export default Report;
