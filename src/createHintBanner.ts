import { NotebookPanel } from '@jupyterlab/notebook';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { showReflectionDialog } from './showReflectionDialog';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { ICellModel } from '@jupyterlab/cells';

function fetchHint() {
  return new Promise<string>(resolve => {
    setTimeout(() => {
      resolve('This is a hint.');
      console.log(1);
    }, 20000);
  });
}

export const createHintBanner = async (
  docManager: IDocumentManager,
  notebookPanel: NotebookPanel,
  pioneer: IJupyterLabPioneer,
  cell: ICellModel,
  postReflection: boolean
) => {
  const gradeId = cell.getMetadata('nbgrader').grade_id;
  const remainingHints = cell.getMetadata('remaining_hints');

  const hintBannerPlaceholder = document.createElement('div');
  hintBannerPlaceholder.id = 'hint-banner-placeholder';
  notebookPanel.content.node.insertBefore(
    hintBannerPlaceholder,
    notebookPanel.content.node.firstChild
  );

  const hintBanner = document.createElement('div');
  hintBanner.id = 'hint-banner';
  notebookPanel.content.node.parentElement?.insertBefore(
    hintBanner,
    notebookPanel.content.node
  );

  hintBanner.innerText =
    'Fetching hint... Please do not refresh the page. \n (It usually takes 1-2 minutes to generate a hint.)';

  const hintContent = await fetchHint();
  hintBanner.innerText = hintContent;
  cell.setMetadata('remaining_hints', remainingHints - 1);
  document.getElementById(gradeId).innerText = `Hint (${
    remainingHints - 1
  } left)`;
  docManager.contextForWidget(notebookPanel).save();

  const hintBannerButtonsContainer = document.createElement('div');
  hintBannerButtonsContainer.id = 'hint-banner-buttons-container';

  const hintBannerButtons = document.createElement('div');
  hintBannerButtons.id = 'hint-banner-buttons';
  const helpfulButton = document.createElement('button');
  helpfulButton.classList.add('hint-banner-button');
  helpfulButton.innerText = 'Helpful 👍';
  const unhelpfulButton = document.createElement('button');
  unhelpfulButton.classList.add('hint-banner-button');
  unhelpfulButton.innerText = 'Unhelpful 👎';

  const hintBannerButtonClicked = async (evaluation: string) => {
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'HintEvaluated',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId,
            hintContent: hintContent,
            evaluation: evaluation
          }
        },
        exporter,
        true
      );
    });
    if (postReflection) {
      const dialogResult = await showReflectionDialog(
        'Write a brief statement of what you learned from the hint and how you will use it to solve the problem.'
      );

      if (dialogResult.button.label === 'Submit') {
        hintBanner.remove();
        hintBannerPlaceholder.remove();
      }

      pioneer.exporters.forEach(exporter => {
        pioneer.publishEvent(
          notebookPanel,
          {
            eventName: 'PostReflection',
            eventTime: Date.now(),
            eventInfo: {
              status: dialogResult.button.label,
              gradeId: gradeId,
              reflection: dialogResult.value
            }
          },
          exporter,
          false
        );
      });
    } else {
      hintBanner.remove();
      hintBannerPlaceholder.remove();
    }
  };
  helpfulButton.onclick = () => {
    hintBannerButtonClicked('helpful');
  };
  unhelpfulButton.onclick = () => {
    hintBannerButtonClicked('unhelpful');
  };
  hintBannerButtons.appendChild(helpfulButton);
  hintBannerButtons.appendChild(unhelpfulButton);

  hintBannerButtonsContainer.appendChild(hintBannerButtons);
  hintBanner.appendChild(hintBannerButtonsContainer);
};
