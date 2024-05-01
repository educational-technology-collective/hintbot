import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { requestHint } from './requestHint';
// import { HintTypeSelectionWidget } from './showHintTypeDialog';

const activateHintBot = async (
  notebookPanel: NotebookPanel,
  settings: ISettingRegistry.ISettings,
  pioneer: IJupyterLabPioneer
) => {
  const hintQuantity = settings.get('hintQuantity').composite as number;
  const cells = notebookPanel.content.model?.cells;

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
        // hardcode question identifier, to be removed after notebook updated and deployed
      ) {
        const hintButton = document.createElement('button');
        hintButton.classList.add('hint-button');
        hintButton.id = cells.get(i).getMetadata('nbgrader').grade_id;
        hintButton.onclick = () =>
          requestHint(notebookPanel, settings, pioneer, cells.get(i));
        notebookPanel.content.widgets[i].node.appendChild(hintButton);

        if (cells.get(i).getMetadata('remaining_hints') === undefined) {
          cells.get(i).setMetadata('remaining_hints', hintQuantity);
          hintButton.innerText = `Hint (${hintQuantity} left for this question)`;
        } else {
          hintButton.innerText = `Hint (${cells
            .get(i)
            .getMetadata('remaining_hints')} left for this question)`;
        }

        // const hint = document.createElement('div');
        // hint.classList.add('hint');

        // const hintLeft = document.createElement('div');
        // hintLeft.classList.add('hint-left');

        // const helpText = document.createElement('div');
        // helpText.classList.add('help-text');
        // helpText.id = cells.get(i).getMetadata('nbgrader').grade_id;
        // hintLeft.appendChild(helpText);
        // if (cells.get(i).getMetadata('remaining_hints') === undefined) {
        //   cells.get(i).setMetadata('remaining_hints', hintQuantity);
        //   helpText.innerText = `Help (${hintQuantity} left for this question)`;
        // } else {
        //   helpText.innerText = `Help (${cells
        //     .get(i)
        //     .getMetadata('remaining_hints')} left for this question)`;
        // }

        // const hintTypeButton = document.createElement('button');
        // hintTypeButton.classList.add('hint-type-button');
        // hintTypeButton.innerText = ' ? ';
        // hintTypeButton.onclick = () => {
        //   showDialog({
        //     body: new HintTypeSelectionWidget(),
        //     buttons: [
        //       Dialog.createButton({
        //         label: 'Dismiss',
        //         className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
        //       })
        //     ]
        //   });
        // };
        // hintLeft.appendChild(hintTypeButton);
        // hint.appendChild(hintLeft);

        // const hintButtons = document.createElement('div');
        // hintButtons.classList.add('hint-buttons');

        // const planning = document.createElement('button');
        // planning.innerText = 'planning';
        // planning.classList.add('hint-button', 'planning');
        // planning.onclick = () =>
        //   requestHint(
        //     notebookPanel,
        //     settings,
        //     pioneer,
        //     cells.get(i),
        //     'planning'
        //   );

        // const debugging = document.createElement('button');
        // debugging.innerText = 'debugging';
        // debugging.classList.add('hint-button', 'debugging');

        // debugging.onclick = () =>
        //   requestHint(
        //     notebookPanel,
        //     settings,
        //     pioneer,
        //     cells.get(i),
        //     'debugging'
        //   );

        // const optimizing = document.createElement('button');
        // optimizing.innerText = 'optimizing';
        // optimizing.classList.add('hint-button', 'optimizing');

        // optimizing.onclick = () =>
        //   requestHint(
        //     notebookPanel,
        //     settings,
        //     pioneer,
        //     cells.get(i),
        //     'optimizing'
        //   );

        // hintButtons.appendChild(planning);
        // hintButtons.appendChild(debugging);
        // hintButtons.appendChild(optimizing);
        // hint.appendChild(hintButtons);

        // notebookPanel.content.widgets[i].node.appendChild(hint);
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
    const activationButton = document.createElement('button');
    activationButton.innerText = 'Activate HintBot Extension';
    activationButton.id = 'hintbot-activation-button';

    const node = document.createElement('div');
    node.appendChild(activationButton);

    const settings = await settingRegistry.load(plugin.id);

    notebookTracker.widgetAdded.connect(
      async (_, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;
        await pioneer.loadExporters(notebookPanel);
        notebookPanel.toolbar.insertAfter(
          'spacer',
          'hintbot-activation-button',
          new Widget({ node: node })
        );
        activationButton.onclick = async () => {
          const dialogResult = await showDialog({
            body: 'The hintbot extension is a prototype and not required to be used for the course. \n The hints generated could be wrong, and it involves sending data to third party services outside of the university.',
            buttons: [
              Dialog.cancelButton({
                label: 'Cancel',
                className: 'jp-mod-reject jp-mod-styled'
              }),
              Dialog.createButton({
                label: 'Confirm activation',
                className: 'jp-mod-accept jp-mod-styled'
              })
            ],
            hasClose: false
          });
          if (dialogResult.button.label === 'Confirm activation') {
            await activateHintBot(notebookPanel, settings, pioneer);
            activationButton.remove();

            pioneer.exporters.forEach(exporter =>
              pioneer.publishEvent(
                notebookPanel,
                {
                  eventName: 'HintBotActivated',
                  eventTime: Date.now()
                },
                exporter,
                false
              )
            );
          }
        };
      }
    );
  }
};

export default plugin;
