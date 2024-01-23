import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { requestHint } from './requestHint';

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

    const hintQuantity = settings.get('hintQuantity').composite as number;

    notebookTracker.widgetAdded.connect(
      async (_, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;
        await pioneer.loadExporters(notebookPanel);

        const cells = notebookPanel.content.model?.cells;

        if (
          cells &&
          notebookPanel.model.getMetadata('etc_identifier') &&
          notebookPanel.model.getMetadata('etc_identifier') ===
            '7ca0093b-b622-4463-8696-65f1e0f33522'
          // hardcode assignment identifier, to be removed after api service fully implemented
        ) {
          for (let i = 0; i < cells.length; i++) {
            if (
              cells.get(i).getMetadata('nbgrader') &&
              cells.get(i).getMetadata('nbgrader')?.cell_type === 'markdown' &&
              cells.get(i).getMetadata('nbgrader')?.grade_id &&
              cells.get(i).getMetadata('nbgrader')?.grade_id !==
                'cell-018440eg2f1b6a62' // hardcode question identifier, to be removed after notebook updated and deployed
            ) {
              const hintButton = document.createElement('button');
              hintButton.classList.add('hint-button');
              hintButton.id = cells.get(i).getMetadata('nbgrader').grade_id;
              hintButton.onclick = () =>
                requestHint(notebookPanel, settings, pioneer, cells.get(i));
              notebookPanel.content.widgets[i].node.appendChild(hintButton);
              if (cells.get(i).getMetadata('remaining_hints') === undefined) {
                cells.get(i).setMetadata('remaining_hints', hintQuantity);
                hintButton.innerText = `Hint (${hintQuantity} left)`;
              } else {
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
