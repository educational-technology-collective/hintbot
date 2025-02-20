# hintbot

A JupyterLab extension that generates AI-powered hints based on students' buggy code and reflection.

This extension is composed of a Python package named `hintbot`
for the server extension and a NPM package named `hintbot`
for the frontend extension.

### Workflow

0. Consent the use of the extension

<a href="screenshots/0_consent.png"><img src="screenshots/0_consent.png" width="800" ></a>

1. (Optional) View explanations of the three hint types

<a href="screenshots/1_ai_hint_types.png"><img src="screenshots/1_ai_hint_types.png" width="800" ></a>

2. Click one of the type buttons to request hint

<a href="screenshots/2_choose_type_n_request.png"><img src="screenshots/2_choose_type_n_request.png" width="800" ></a>

3. (Optional) Reflect on the problem

<a href="screenshots/3_student_reflection.png"><img src="screenshots/3_student_reflection.png" width="800" ></a>

4. Retrieve AI-generated hints based on the buggy code and reflection

<a href="screenshots/4_retrieve_ai_hint.png"><img src="screenshots/4_retrieve_ai_hint.png" width="800" ></a>

5. View and evaluate AI hints

<a href="screenshots/5_view_n_evaluate_ai_hint.png"><img src="screenshots/5_view_n_evaluate_ai_hint.png" width="800" ></a>

6. (Optional) Request instructor help if the AI hints are not helpful

<a href="screenshots/6_request_instructor_help.png"><img src="screenshots/6_request_instructor_help.png" width="800" ></a>

7. Review previous hint

<a href="screenshots/7_review_previous_hints.png"><img src="screenshots/7_review_previous_hints.png" width="800" ></a>


## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install hintbot
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall hintbot
```

## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the hintbot directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable hintbot
# Rebuild extension Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
# Server extension must be manually disabled in develop mode
jupyter server extension disable hintbot
pip uninstall hintbot
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `hintbot` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
