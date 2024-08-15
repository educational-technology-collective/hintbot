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
import { createHintHistoryBar } from './createHintHistoryBar';

const activateHintBot = async (
  notebookPanel: NotebookPanel,
  settings: ISettingRegistry.ISettings,
  pioneer: IJupyterLabPioneer
) => {
  const hintQuantity = settings.get('hintQuantity').composite as number;
  const cells = notebookPanel.content.model?.cells;

  const handleHintButtonClick = async (
    cell: ICellModel,
    cellIndex: number,
    hintType: string
  ) => {
    if (notebookPanel.model.getMetadata('firstTimeUsingHintbot') === true) {
      const dialogResult = await showDialog({
        body: 'The hintbot extension is a prototype and not required to be used for the course. \n The hints generated could be wrong, and it involves sending data to third party services outside of the university.',
        buttons: [
          Dialog.cancelButton({
            label: 'Cancel',
            className: 'jp-mod-reject jp-mod-styled'
          }),
          Dialog.createButton({
            label: 'Request hint',
            className: 'jp-mod-accept jp-mod-styled'
          })
        ],
        hasClose: false
      });
      if (dialogResult.button.label === 'Cancel') {
        return;
      }
      notebookPanel.model.setMetadata('firstTimeUsingHintbot', false);
    }
    requestHint(notebookPanel, settings, pioneer, cell, cellIndex, hintType);
  };

  const createHintRequestBar = (
    cell: ICellModel,
    cellIndex: number,
    hintQuantity: number
  ) => {
    const hintRequestBar = document.createElement('div');
    hintRequestBar.classList.add('hint-request-bar');

    // Text area and info button
    const hintRequestBarLeft = document.createElement('div');
    hintRequestBarLeft.classList.add('hint-request-bar-left');

    const hintRequestBarLeftText = document.createElement('div');
    hintRequestBarLeftText.classList.add('hint-request-bar-left-text');
    hintRequestBarLeftText.id = cell.getMetadata('nbgrader').grade_id;
    hintRequestBarLeft.appendChild(hintRequestBarLeftText);
    if (cell.getMetadata('remaining_hints') === undefined) {
      cell.setMetadata('remaining_hints', hintQuantity);
      hintRequestBarLeftText.innerText = `Request Hint (${hintQuantity} left for this question)`;
    } else {
      hintRequestBarLeftText.innerText = `Request Hint (${cell.getMetadata(
        'remaining_hints'
      )} left for this question)`;
    }

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
    };
    hintRequestBarLeft.appendChild(hintRequestBarLeftInfoBtn);

    // Planning, Debugging, Optimizing
    const hintRequestBarRight = document.createElement('div');
    hintRequestBarRight.classList.add('hint-request-bar-right');

    const planning = document.createElement('button');
    planning.innerText = 'Planning';
    planning.classList.add('hint-request-bar-right-request-button', 'planning');
    planning.onclick = () => handleHintButtonClick(cell, cellIndex, 'planning');

    const debugging = document.createElement('button');
    debugging.innerText = 'Debugging';
    debugging.classList.add(
      'hint-request-bar-right-request-button',
      'debugging'
    );

    debugging.onclick = () =>
      handleHintButtonClick(cell, cellIndex, 'debugging');

    const optimizing = document.createElement('button');
    optimizing.innerText = 'Optimizing';
    optimizing.classList.add(
      'hint-request-bar-right-request-button',
      'optimizing'
    );

    optimizing.onclick = () =>
      handleHintButtonClick(cell, cellIndex, 'optimizing');

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
    for (let i = 0; i < cells.length; i++) {
      if (
        cells.get(i).getMetadata('nbgrader') &&
        cells.get(i).getMetadata('nbgrader')?.cell_type === 'markdown' &&
        cells.get(i).getMetadata('nbgrader')?.grade_id &&
        ![
          'cell-d4da7eb9acee2a6d',
          'cell-a839e7b47494b4c2',
          'cell-018440ed2f1b6a62',
          'cell-018440eg2f1b6a62'
        ].includes(cells.get(i).getMetadata('nbgrader')?.grade_id)
      ) {
        const hintRequestBar = createHintRequestBar(
          cells.get(i),
          i,
          hintQuantity
        );
        notebookPanel.content.widgets[i].node.appendChild(hintRequestBar);
        createHintHistoryBar(cells.get(i), i, notebookPanel, pioneer);
      }
    }
  }
};

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hintbot:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker, ISettingRegistry, IJupyterLabPioneer],
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    pioneer: IJupyterLabPioneer
  ) => {
    const settings = await settingRegistry.load(plugin.id);

    notebookTracker.widgetAdded.connect(
      async (_, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;
        await pioneer.loadExporters(notebookPanel);
        await activateHintBot(notebookPanel, settings, pioneer);
      }
    );
  }
};

export default plugin;
