import React from 'react';

import Message, { MessageType } from 'components/Message';
import Page from 'components/Page';

import css from './Report.module.scss';

const Report: React.FC = () => {
  const msg = 'set the remote server: `dev.setServerAddress(ADDRESS)`';
  return (
    <Page className={css.base} title="Report">
      <Message message={msg} title="msg" type={MessageType.Empty} />
    </Page>
  );
};

export default Report;
