import { NotebookPanel } from '@jupyterlab/notebook';
import { ICellModel } from '@jupyterlab/cells';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { requestAPI } from './handler';

export const createHintHistoryBar = async (
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
      if (!hintHistoryData[i].isGPT && !hintHistoryData[i]?.hintContent) {
        const response: any = await requestAPI('check_ta', {
          method: 'POST',
          body: JSON.stringify({
            request_id: hintHistoryData[i].requestId
          })
        });
        if (response.statusCode == 200) {
          console.log(response);
          if (response.feedback_ready)
            hintHistoryData[i]['hintContent'] = response.feedback;
        } else {
          hintHistoryData[i]['error'] = response.message;
        }
      }
      if (hintHistoryData[i]?.hintContent) {
        const hintHistoryBarEntry = document.createElement('div');
        const accordion = document.createElement('button');
        accordion.classList.add('accordion');
        if (!hintHistoryData[i].isGPT) accordion.classList.add('ta-accordion');
        accordion.innerText = hintHistoryData[i].isGPT
          ? `Click to review previous GPT hint ${i + 1} (${
              hintHistoryData[i].hintType
            })`
          : `Click to review previous instructor hint ${i + 1} (${
              hintHistoryData[i].hintType
            })`;

        const panel = document.createElement('div');
        panel.classList.add('accordion-panel');
        if (!hintHistoryData[i].isGPT)
          panel.classList.add('ta-accordion-panel');
        const historyText = document.createElement('p');
        historyText.classList.add();
        historyText.innerText = hintHistoryData[i].hintContent;
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
                  eventName: 'HintHistoryReview',
                  eventTime: Date.now(),
                  eventInfo: {
                    gradeId: cell.getMetadata('nbgrader').grade_id,
                    hintType: hintHistoryData[i][0],
                    hintContent: hintHistoryData[i][1]
                  }
                },
                exporter,
                false
              );
            });
          } else {
            pioneer.exporters.forEach(exporter => {
              pioneer.publishEvent(
                notebookPanel,
                {
                  eventName: 'HintHistoryHide',
                  eventTime: Date.now(),
                  eventInfo: {
                    gradeId: cell.getMetadata('nbgrader').grade_id,
                    hintType: hintHistoryData[i][0],
                    hintContent: hintHistoryData[i][1]
                  }
                },
                exporter,
                false
              );
            });
          }
        });
      } else if (hintHistoryData[i]?.errorMessage) {
        const accordion = document.createElement('button');
        accordion.classList.add('accordion', 'error');
        accordion.innerText = hintHistoryData[i].error;
      }
    }
    notebookPanel.content.widgets[cellIndex].node.appendChild(hintHistoryBar);
  }
  cell.setMetadata('hintHistory', hintHistoryData);
};
