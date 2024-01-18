import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { requestHint } from './requestHint';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hintbot:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [
    IDocumentManager,
    INotebookTracker,
    ISettingRegistry,
    IJupyterLabPioneer
  ],
  activate: async (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    pioneer: IJupyterLabPioneer
  ) => {
    console.log('JupyterLab extension hintbot is activated!');

    const settings = await settingRegistry.load(plugin.id);

    const hintQuantity = settings.get('hintQuantity').composite as number;

    notebookTracker.widgetAdded.connect(
      async (_, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;
        await pioneer.loadExporters(notebookPanel);

        const cells = notebookPanel.content.model?.cells;
        if (cells) {
          for (let i = 0; i < cells.length; i++) {
            if (
              cells.get(i).getMetadata('nbgrader') &&
              cells.get(i).getMetadata('nbgrader')?.grade_id &&
              cells.get(i).getMetadata('nbgrader')?.cell_type === 'markdown'
            ) {
              const hintButton = document.createElement('button');
              hintButton.classList.add('hint-button');
              hintButton.id = cells.get(i).getMetadata('nbgrader').grade_id;
              hintButton.onclick = () =>
                requestHint(
                  docManager,
                  notebookPanel,
                  settings,
                  pioneer,
                  cells.get(i)
                );
              notebookPanel.content.widgets[i].node.appendChild(hintButton);
              if (cells.get(i).getMetadata('remaining_hints') === undefined) {
                cells.get(i).setMetadata('remaining_hints', hintQuantity);
                hintButton.innerText = `Hint (${hintQuantity} left)`;
              }
              else {
                hintButton.innerText = `Hint (${cells
                .get(i)
                .getMetadata('remaining_hints')} left)`;
              }
            }
          }
        }
      }
    );
  }
};

export default plugin;
