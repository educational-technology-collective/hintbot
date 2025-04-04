import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { ICellModel } from '@jupyterlab/cells';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { requestHint } from './requestHint';
import { HintTypeSelectionWidget } from './showHintTypeDialog';
import { HintConsentWidget } from './showConsentDialog';
import {
  checkInstructorFeedback,
  createHintHistoryBar
} from './createHintHistoryBar';

const activateHintBot = async (
  notebookPanel: NotebookPanel,
  pioneer: IJupyterLabPioneer
) => {
  const cells = notebookPanel.content.model?.cells;

  const handleHintButtonClick = async (
    cell: ICellModel,
    cellIndex: number,
    hintType: string
  ) => {
    if (notebookPanel.model.getMetadata('firstTimeUsingHintbot') === true) {
      const dialogResult = await showDialog({
        body: new HintConsentWidget(),
        buttons: [
          Dialog.cancelButton({
            label: 'Cancel',
            className: 'jp-mod-reject jp-mod-styled'
          }),
          Dialog.createButton({
            label: 'Consent and request hint',
            className: 'jp-mod-accept jp-mod-styled'
          })
        ],
        hasClose: false
      });
      if (dialogResult.button.label === 'Cancel') {
        return;
      }
      pioneer.exporters.forEach(exporter => {
        pioneer.publishEvent(
          notebookPanel,
          {
            eventName: 'FirstTimeUsingHintbot',
            eventTime: Date.now(),
            eventInfo: {
              status: dialogResult.button.label
            }
          },
          exporter,
          false
        );
      });
      notebookPanel.model.setMetadata('firstTimeUsingHintbot', false);
    }
    requestHint(notebookPanel, pioneer, cell, cellIndex, hintType);
  };

  const createHintRequestBar = (cell: ICellModel, cellIndex: number) => {
    const hintRequestBar = document.createElement('div');
    hintRequestBar.classList.add('hint-request-bar');

    // Text area and info button
    const hintRequestBarLeft = document.createElement('div');
    hintRequestBarLeft.classList.add('hint-request-bar-left');

    const hintRequestBarLeftText = document.createElement('div');
    hintRequestBarLeftText.classList.add('hint-request-bar-left-text');
    // hintRequestBarLeftText.id = cell.getMetadata('nbgrader').grade_id;
    hintRequestBarLeft.appendChild(hintRequestBarLeftText);
    hintRequestBarLeftText.innerText = 'Request Hint';

    const hintRequestBarLeftInfoBtn = document.createElement('button');
    hintRequestBarLeftInfoBtn.classList.add(
      'hint-request-bar-left-info-button'
    );
    hintRequestBarLeftInfoBtn.innerText = ' ? ';
    hintRequestBarLeftInfoBtn.onclick = () => {
      showDialog({
        body: new HintTypeSelectionWidget(),
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
            eventName: 'HintTypeReview',
            eventTime: Date.now()
          },
          exporter,
          false
        );
      });
    };
    hintRequestBarLeft.appendChild(hintRequestBarLeftInfoBtn);

    // Planning, Debugging, Optimizing
    const hintRequestBarRight = document.createElement('div');
    hintRequestBarRight.id = cell.getMetadata('nbgrader').grade_id;
    hintRequestBarRight.classList.add('hint-request-bar-right');

    const planning = document.createElement('button');
    // planning.innerText = 'Planning';
    planning.classList.add('hint-request-bar-right-request-button', 'planning');
    planning.onclick = () => handleHintButtonClick(cell, cellIndex, 'planning');

    const debugging = document.createElement('button');
    // debugging.innerText = 'Debugging';
    debugging.classList.add(
      'hint-request-bar-right-request-button',
      'debugging'
    );

    debugging.onclick = () =>
      handleHintButtonClick(cell, cellIndex, 'debugging');

    const optimizing = document.createElement('button');
    // optimizing.innerText = 'Optimizing';
    optimizing.classList.add(
      'hint-request-bar-right-request-button',
      'optimizing'
    );

    optimizing.onclick = () =>
      handleHintButtonClick(cell, cellIndex, 'optimizing');

    if (cell.getMetadata('remaining_hints') === undefined) {
      cell.setMetadata('remaining_hints', {
        planning: 1,
        debugging: 3,
        optimizing: 1
      });
      planning.innerHTML = `Planning hint (<span class='hint-quantity'>1</span> left)`;
      debugging.innerHTML = `Debugging hint (<span class='hint-quantity'>3</span> left)`;
      optimizing.innerHTML = `Optimizing hint (<span class='hint-quantity'>1</span> left)`;
    } else {
      const remainingHints = cell.getMetadata('remaining_hints');
      planning.innerHTML = `Planning hint (<span class='hint-quantity'>${remainingHints.planning}</span> left)`;
      debugging.innerHTML = `Debugging hint (<span class='hint-quantity'>${remainingHints.debugging}</span> left)`;
      optimizing.innerHTML = `Optimizing hint (<span class='hint-quantity'>${remainingHints.optimizing}</span> left)`;
    }

    hintRequestBarRight.appendChild(planning);
    hintRequestBarRight.appendChild(debugging);
    hintRequestBarRight.appendChild(optimizing);

    hintRequestBar.appendChild(hintRequestBarLeft);
    hintRequestBar.appendChild(hintRequestBarRight);

    return hintRequestBar;
  };

  if (notebookPanel.model.getMetadata('firstTimeUsingHintbot') === undefined)
    notebookPanel.model.setMetadata('firstTimeUsingHintbot', true);

  if (cells) {
    let questionIndex = 1;
    for (let i = 0; i < cells.length; i++) {
      if (
        cells.get(i).getMetadata('nbgrader') &&
        cells.get(i)?.type === 'markdown' &&
        cells.get(i).getMetadata('nbgrader')?.grade_id &&
        ![
          'cell-d4da7eb9acee2a6d',
          'cell-a839e7b47494b4c2',
          'cell-018440ed2f1b6a62',
          'cell-018440eg2f1b6a62'
        ].includes(cells.get(i).getMetadata('nbgrader')?.grade_id)
      ) {
        cells.get(i).setMetadata('questionIndex', questionIndex);
        questionIndex += 1;

        const hintRequestBar = createHintRequestBar(cells.get(i), i);
        notebookPanel.content.widgets[i].node.appendChild(hintRequestBar);

        await checkInstructorFeedback(cells.get(i), notebookPanel, pioneer);
        await createHintHistoryBar(cells.get(i), i, notebookPanel, pioneer);

        setInterval(async () => {
          const receivedNewInstructorFeedbackOrNot =
            await checkInstructorFeedback(cells.get(i), notebookPanel, pioneer);
          console.log(
            `Check instructor feedback for question ${questionIndex}`
          );

          if (receivedNewInstructorFeedbackOrNot === true) {
            console.log(
              `Received new instructor feedback for question ${questionIndex}, recreating history bar`
            );
            await createHintHistoryBar(cells.get(i), i, notebookPanel, pioneer);
          }
        }, 300000);
      }
    }
  }
};

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hintbot:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker, IJupyterLabPioneer],
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    pioneer: IJupyterLabPioneer
  ) => {
    notebookTracker.widgetAdded.connect(
      async (_, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;
        await pioneer.loadExporters(notebookPanel);
        await activateHintBot(notebookPanel, pioneer);
      }
    );
  }
};

export default plugin;
