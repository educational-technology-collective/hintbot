import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';

export class ReflectionInputWidget extends ReactWidget {
  private _message = '';
  constructor(message: string) {
    super();
    this._message = message;
  }
  getValue(): string {
    return this.node.querySelector('textarea').value;
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
