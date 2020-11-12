import { Breadcrumb } from 'antd';
import React, { useMemo } from 'react';
import MonacoEditor from 'react-monaco-editor';

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
  configPath?: string[][]; // path to the intereseting part of config
  trialChartProps: TrialChartProps;
  experiment: ExperimentDetails;
}

const getPathListWithKey = (data: RawJson, path: string[]) => {
  return path.length ? { [path[path.length-1]]: getPathList(data, path) } : data;
};

const configRenderer = (conf: RawJson, path?: string[][]) => {
  if (path === undefined) return;
  let newConf: RawJson;
  if (path.length) {
    newConf = path.map(pathList => {
      const subConf = pathList.length ? { [pathList[pathList.length-1]]: getPathList(conf, pathList) } : conf;
      return subConf;
    })
      .reduce((acc, cur) => ({ ...acc, ...cur }), {});
  } else {
    newConf = conf;
  }

  const confA = <MonacoEditor
    height="20rem"
    language="json"
    options={{
      lineNumbers: 'off',
      minimap: { enabled: false },
      occurrencesHighlight: false,
      readOnly: true,
      scrollBeyondLastLine: false,
      selectOnLineNumbers: true,
    }}
    theme="vs-light"
    value={JSON.stringify(newConf, null, 2)} />;
  const confB = <pre>{JSON.stringify(newConf, null, 2)}</pre>;
  return confB;
};

const TrialCard: React.FC<Props> = ({ trial, experiment, ...p }: Props) => {
  const durations = useMemo(() => trialDurations(trial.steps), [ trial.steps ]);

  return <Section
    bodyBorder
    options={
      <Breadcrumb>
        <Breadcrumb.Item>
          <Link path={`/experiments/${experiment.id}`}>Experiment {experiment.id}</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link path={`/trials/${trial.id}`}>Trial {trial.id}</Link>
        </Breadcrumb.Item>
      </Breadcrumb>
    }
    title={p.title || `Trial ${trial.id} Card`}
  >
    <div className={css.body}>
      <p>stats</p>
      <p>experiment launched {experiment.trials.length} trials</p>

      <div className={css.duration}>
        <h5>Durations</h5>
        <div>Training: {shortEnglishHumannizer(durations.train)}</div>
        <div>Checkpointing: {shortEnglishHumannizer(durations.checkpoint)}</div>
        <div>Validating: {shortEnglishHumannizer(durations.validation)}</div>
        {/* <TrialInfoBox experiment={experiment} trial={trial} /> */}
      </div>

      {p.configPath &&
      <div>
        <h5>Config</h5>
        <p>some text about this</p>
        {configRenderer(experiment.configRaw, p.configPath)}
      </div>
      }

      <TrialChart steps={trial.steps} {...p.trialChartProps} />
    </div>

    {/* <TrialInfoBox experiment={experiment} trial={trial} /> */}
  </Section>;
};

export default TrialCard;
