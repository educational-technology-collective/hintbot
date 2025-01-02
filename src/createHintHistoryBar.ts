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
          if (response.feedback_ready)
            hintHistoryData[i]['hintContent'] = response.feedback;
          pioneer.exporters.forEach(exporter => {
            pioneer.publishEvent(
              notebookPanel,
              {
                eventName: 'GetTAHint',
                eventTime: Date.now(),
                eventInfo: {
                  gradeId: cell.getMetadata('nbgrader').grade_id,
                  requestId: hintHistoryData[i].requestId,
                  hintType: hintHistoryData[i].hintType,
                  hintContent: response.feedback
                }
              },
              exporter,
              false
            );
          });
        } else {
          hintHistoryData[i]['error'] = response.message;

          pioneer.exporters.forEach(exporter => {
            pioneer.publishEvent(
              notebookPanel,
              {
                eventName: 'GetTAHint',
                eventTime: Date.now(),
                eventInfo: {
                  gradeId: cell.getMetadata('nbgrader').grade_id,
                  requestId: hintHistoryData[i].requestId,
                  hintType: hintHistoryData[i].hintType,
                  error: response.message
                }
              },
              exporter,
              false
            );
          });
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
          pioneer.exporters.forEach(exporter => {
            pioneer.publishEvent(
              notebookPanel,
              {
                eventName: this.classList.contains('active')
                  ? 'HintHistoryReview'
                  : 'HintHistoryHide',
                eventTime: Date.now(),
                eventInfo: {
                  gradeId: cell.getMetadata('nbgrader').grade_id,
                  requestId: hintHistoryData[i].requestId,
                  isGPT: hintHistoryData[i].isGPT,
                  hintType: hintHistoryData[i].hintType,
                  hintContent: hintHistoryData[i].hintContent
                }
              },
              exporter,
              false
            );
          });
        });
      } else if (hintHistoryData[i]?.errorMessage) {
        const accordion = document.createElement('button');
        accordion.classList.add('accordion', 'accordion-error');
        accordion.innerText = hintHistoryData[i].error;
        const hintHistoryBarEntry = document.createElement('div');
        hintHistoryBarEntry.appendChild(accordion);
        hintHistoryBar.appendChild(hintHistoryBarEntry);
      }
    }
    notebookPanel.content.widgets[cellIndex].node.appendChild(hintHistoryBar);
  }
  cell.setMetadata('hintHistory', hintHistoryData);
};
