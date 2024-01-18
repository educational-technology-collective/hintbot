import { NotebookPanel } from '@jupyterlab/notebook';
import { showReflectionDialog } from './showReflectionDialog';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';

function fetchHint() {
  return new Promise<string>(resolve => {
    setTimeout(() => {
      resolve('This is a hint.');
      console.log(1);
    }, 20000);
  });
}

export const createHintBanner = async (
  notebookPanel: NotebookPanel,
  pioneer: IJupyterLabPioneer,
  gradeId: string,
  postReflection: boolean
) => {
  if (document.getElementById('hint-banner')) {
    return;
  }
  const hintBannerPlaceholder = document.createElement('div');
  hintBannerPlaceholder.id = 'hint-banner-placeholder';
  notebookPanel.content.node.insertBefore(
    hintBannerPlaceholder,
    notebookPanel.content.node.firstChild
  );

  const hintBanner = document.createElement('div');
  hintBanner.id = 'hint-banner';
  // hintBanner.innerText = hint;
  notebookPanel.content.node.parentElement?.insertBefore(
    hintBanner,
    notebookPanel.content.node
  );

  hintBanner.innerText = 'Fetching hint... Please do not refresh the page. \n (It usually takes 1-2 minutes to generate a hint.)';

  const hintContent = await fetchHint();

  hintBanner.innerText = hintContent;

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
            evaluation: evaluation
          }
        },
        exporter,
        false
      );
    });
    if (postReflection) {
      pioneer.exporters.forEach(exporter => {
        pioneer.publishEvent(
          notebookPanel,
          {
            eventName: 'PreReflectionDialogDisplayed',
            eventTime: Date.now(),
            eventInfo: {
              gradeId: gradeId
            }
          },
          exporter,
          false
        );
      });

      const dialogResult = await showReflectionDialog(
        'Write a brief statement of what you learned from the hint and how you will use it to solve the problem.'
      );

      if (dialogResult.button.label === 'Submit') {
        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'PostReflectionSubmitted',
              eventTime: Date.now(),
              eventInfo: {
                gradeId: gradeId,
                reflection: dialogResult.value
              }
            },
            exporter,
            false
          );
        });
        hintBanner.remove();
        hintBannerPlaceholder.remove();
      }
      if (dialogResult.button.label === 'Cancel') {
        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'PostReflectionCanceled',
              eventTime: Date.now(),
              eventInfo: {
                gradeId: gradeId,
                reflection: dialogResult.value
              }
            },
            exporter,
            false
          );
        });
      }
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

  pioneer.exporters.forEach(exporter => {
    pioneer.publishEvent(
      notebookPanel,
      {
        eventName: 'HintBannerAdded',
        eventTime: Date.now(),
        eventInfo: {
          gradeId: gradeId
        }
      },
      exporter,
      false
    );
  });
};
