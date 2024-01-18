import React from 'react';
import { Dialog, showDialog, ReactWidget } from '@jupyterlab/apputils';

class ReflectionInputWidget extends ReactWidget {
  private _message = '';
  constructor(message: string) {
    super();
    this._message = message;
  }
  getValue(): string | undefined {
    return this.node.querySelector('textarea')?.value;
  }
  protected render(): React.ReactElement<any> {
    return (
      <div className="reflection">
        <label>
          {this._message}
          <textarea
            name="reflection-input"
            className="reflection-input"
            rows={10}
          />
        </label>
      </div>
    );
  }
}

export const showReflectionDialog = (message: string) => {
  return showDialog({
    title: 'Reflection',
    body: new ReflectionInputWidget(message),
    buttons: [
      Dialog.createButton({ label: 'Cancel' }),
      Dialog.createButton({ label: 'Submit' })
    ],
    hasClose: false
  });
};
