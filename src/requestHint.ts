import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { v4 as uuidv4 } from 'uuid';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { showReflectionDialog } from './showReflectionDialog';
import { createHintBanner } from './createHintBanner';
import { ICellModel } from '@jupyterlab/cells';
import { requestAPI } from './handler';

export const requestHint = async (
  notebookPanel: NotebookPanel,
  settings: ISettingRegistry.ISettings,
  pioneer: IJupyterLabPioneer,
  cell: ICellModel,
  cellIndex: number,
  hintType: string
) => {
  const gradeId = cell.getMetadata('nbgrader')?.grade_id;
  const remainingHints = cell.getMetadata('remaining_hints');

  if (document.getElementById('hint-banner')) {
    showDialog({
      title: 'Please review previous hint first.',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
        })
      ]
    });
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'HintAlreadyExists',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId
          }
        },
        exporter,
        false
      );
    });
  } else if (remainingHints < 1) {
    showDialog({
      title: 'No hint left for this question.',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
        })
      ]
    });
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'NotEnoughHint',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId
          }
        },
        exporter,
        false
      );
    });
  } else {
    const uuid = uuidv4();

    const workspace_id: string = await requestAPI('id');
    const promptGroupNum =
      workspace_id
        .split('')
        .map(c => c.charCodeAt(0) - 64)
        .reduce((acc, val) => acc + val, 0) % 2;
    const promptGroup = promptGroupNum === 0 ? 'promptA' : 'promptB';
    console.log(`Condition ${promptGroup}`);

    const configs = [
      {
        hintType: 'planning',
        serverHintType: 'plan',
        promptA:
          'Considering your program and the feedback you have received from the system so far, what do you think is a possible issue with the program plan, i.e., problem-solving steps of the program?',
        promptB:
          'Considering your program and the feedback you have received from the system so far, what do you think is a possible issue with the program plan, i.e., problem-solving steps of the program? When writing your reflection, consider which steps in your program plan could be improved and how do you think the program plan can be updated to solve this question.'
      },
      {
        hintType: 'debugging',
        serverHintType: 'debug',
        promptA:
          'Considering your program and the feedback you have received from the system so far, what do you think is a possible bug in the program?',
        promptB:
          'Considering your program and the feedback you have received from the system so far, what do you think is a possible bug in the program? When writing your reflection, consider how the bug affects the program and what do you think is a way to fix the bug.'
      },
      {
        hintType: 'optimizing',
        serverHintType: 'optimize',
        promptA:
          'Considering your program and the feedback you have received from the system so far, what do you think is a possible issue with the program in terms of performance (e.g., speed or memory usage) and readability?',
        promptB:
          'Considering your program and the feedback you have received from the system so far, what do you think is a possible issue with the program in terms of performance (e.g., speed or memory usage) and readability? When writing your reflection, consider which parts of the program needs to be optimized and how do you think the program can be updated for optimization.'
      }
    ];

    const response: any = await requestAPI('hint', {
      method: 'POST',
      body: JSON.stringify({
        hint_type: configs.find(config => config.hintType === hintType)
          .serverHintType,
        problem_id: gradeId,
        buggy_notebook_path: notebookPanel.context.path
      })
    });

    console.log('create ticket', response);
    const requestId = response?.request_id;

    cell.setMetadata('remaining_hints', remainingHints - 1);
    document.getElementById(gradeId).innerText = `Request Hint (${
      remainingHints - 1
    } left for this question)`;
    notebookPanel.context.save();

    const dialogResult = await showReflectionDialog(
      configs.find(config => config.hintType === hintType)[promptGroup]
    );

    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'Reflection',
          eventTime: Date.now(),
          eventInfo: {
            status: dialogResult.button.label,
            gradeId: gradeId,
            uuid: uuid,
            hintType: hintType,
            promptGroup: promptGroup,
            prompt: configs.find(config => config.hintType === hintType)[
              promptGroup
            ],
            reflection: dialogResult.value
          }
        },
        exporter,
        true
      );
    });
    if (dialogResult.button.label === 'Cancel') {
      pioneer.exporters.forEach(exporter => {
        pioneer.publishEvent(
          notebookPanel,
          {
            eventName: 'ReflectionCanceled',
            eventTime: Date.now(),
            eventInfo: {
              status: dialogResult.button.label,
              gradeId: gradeId,
              uuid: uuid,
              hintType: hintType,
              promptGroup: promptGroup,
              prompt: configs.find(config => config.hintType === hintType)[
                promptGroup
              ],
              reflection: dialogResult.value
            }
          },
          exporter,
          false
        );
      });
    } else {
      createHintBanner(
        notebookPanel,
        pioneer,
        cell,
        cellIndex,
        promptGroup,
        configs.find(config => config.hintType === hintType)[promptGroup],
        uuid,
        dialogResult.value,
        hintType,
        requestId
      );
    }
    // }
  }
};
