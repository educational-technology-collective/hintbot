import { NotebookPanel } from '@jupyterlab/notebook';
import { ICellModel } from '@jupyterlab/cells';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';

export const createHintHistoryBar = (
  cell: ICellModel,
  cellIndex: number,
  notebookPanel: NotebookPanel,
  pioneer: IJupyterLabPioneer
) => {
  if (document.getElementById(`hint-history-bar-${cell.id}`)) {
    document.getElementById(`hint-history-bar-${cell.id}`).remove();
  }
  const hintHistoryData = cell.getMetadata('hintHistory');
  const hintHistoryBar = document.createElement('div');
  hintHistoryBar.classList.add('hint-history-bar');
  hintHistoryBar.id = `hint-history-bar-${cell.id}`;

  if (hintHistoryData && hintHistoryData.length > 0) {
    for (let i = 0; i < hintHistoryData.length; i++) {
      const hintHistoryBarEntry = document.createElement('div');
      const accordion = document.createElement('button');
      accordion.classList.add('accordion');
      accordion.innerText = `Click to review previous hint ${i + 1} (${
        hintHistoryData[i][0]
      })`;

      const panel = document.createElement('div');
      panel.classList.add('panel');
      const historyText = document.createElement('p');
      historyText.classList.add();
      historyText.innerText = hintHistoryData[i][1];
      panel.appendChild(historyText);
      hintHistoryBarEntry.appendChild(accordion);
      hintHistoryBarEntry.appendChild(panel);
      hintHistoryBar.appendChild(hintHistoryBarEntry);

      accordion.addEventListener('click', function () {
        this.classList.toggle('active');
        if (panel.style.maxHeight) {
          panel.style.maxHeight = null;
        } else {
          panel.style.maxHeight = panel.scrollHeight + 'px';
        }
        if (this.classList.contains('active')) {
          pioneer.exporters.forEach(exporter => {
            pioneer.publishEvent(
              notebookPanel,
              {
                eventName: 'HintHistoryReviewEvent',
                eventTime: Date.now(),
                eventInfo: {
                  gradeId: cell.getMetadata('nbgrader').grade_id,
                  hintType: hintHistoryData[i][0],
                  hintContent: hintHistoryData[i][1]
                }
              },
              exporter,
              true
            );
          });
        }
      });
    }
    notebookPanel.content.widgets[cellIndex].node.appendChild(hintHistoryBar);
  }
};
