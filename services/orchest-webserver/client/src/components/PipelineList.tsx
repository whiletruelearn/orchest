import * as React from "react";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
import {
  MDCIconButtonToggleReact,
  MDCButtonReact,
  MDCTextFieldReact,
  MDCLinearProgressReact,
  MDCDialogReact,
  MDCDataTableReact,
} from "@orchest/lib-mdc";
import { useOrchest } from "@/hooks/orchest";
import { checkGate } from "../utils/webserver-utils";
import SessionToggleButton from "./SessionToggleButton";
import PipelineView from "../pipeline-view/PipelineView";
import ProjectsView from "@/views/ProjectsView";

const INITIAL_PIPELINE_NAME = "Main";
const INITIAL_PIPELINE_PATH = "main.orchest";

const PipelineList: React.FC<any> = (props) => {
  const { orchest } = window;

  const context = useOrchest();

  const [state, setState] = React.useState({
    loading: true,
    isDeleting: false,
    createModal: false,
    createPipelineName: INITIAL_PIPELINE_NAME,
    createPipelinePath: INITIAL_PIPELINE_PATH,
    editPipelinePathModal: false,
    editPipelinePathModalBusy: false,
    editPipelinePath: undefined,
    editPipelinePathUUID: undefined,
    listData: null,
    pipelines: null,
  });

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  const processListData = (pipelines) => {
    let listData = [];

    for (let pipeline of pipelines) {
      // @TODO Get the current Project on the Pipelines page
      listData.push([
        <span data-test-id={`pipeline-${pipeline.name}`}>{pipeline.name}</span>,
        <span className="mdc-icon-table-wrapper">
          {pipeline.path}{" "}
          <span className="consume-click">
            <MDCIconButtonToggleReact
              icon="edit"
              onClick={() => {
                onEditClick(pipeline.uuid, pipeline.path);
              }}
              data-test-id="pipeline-edit-path"
            />
          </span>
        </span>,
        <SessionToggleButton
          project_uuid={context.state.project_uuid}
          pipeline_uuid={pipeline.uuid}
          switch={true}
          className="consume-click"
        />,
      ]);
    }

    return listData;
  };

  const fetchList = (onComplete) => {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${props.project_uuid}`),
      promiseManager
    );

    fetchListPromise.promise
      .then((response) => {
        let data = JSON.parse(response);
        setState((prevState) => ({
          ...prevState,
          listData: processListData(data.result),
          pipelines: data.result,
        }));

        if (refManager.refs.pipelineListView) {
          refManager.refs.pipelineListView.setSelectedRowIds([]);
        }

        onComplete();
      })
      .catch((e) => {
        if (e && e.status == 404) {
          // @ts-ignore
          orchest.loadView(ProjectsView);
        }
      });
  };

  const openPipeline = (pipeline, readOnly) => {
    // load pipeline view
    let pipelineProps = {
      queryArgs: {
        pipeline_uuid: pipeline.uuid,
        project_uuid: props.project_uuid,
      },
    };

    if (readOnly) {
      // @ts-ignore
      pipelineProps.queryArgs.read_only = "true";
    }

    // @ts-ignore
    orchest.loadView(PipelineView, pipelineProps);
  };

  const onClickListItem = (row, idx, e) => {
    let pipeline = state.pipelines[idx];

    let checkGatePromise = checkGate(props.project_uuid);
    checkGatePromise
      .then(() => {
        openPipeline(pipeline, false);
      })
      .catch((result) => {
        openPipeline(pipeline, true);
      });
  };

  const onDeleteClick = () => {
    if (!state.isDeleting) {
      setState((prevState) => ({
        ...prevState,
        isDeleting: true,
      }));

      let selectedIndices = refManager.refs.pipelineListView.getSelectedRowIndices();

      if (selectedIndices.length === 0) {
        // @ts-ignore
        orchest.alert("Error", "You haven't selected a pipeline.");

        setState((prevState) => ({
          ...prevState,
          isDeleting: false,
        }));

        return;
      }

      // @ts-ignore
      orchest.confirm(
        "Warning",
        "Are you certain that you want to delete this pipeline? (This cannot be undone.)",
        () => {
          setState((prevState) => ({
            ...prevState,
            loading: true,
          }));

          selectedIndices.forEach((index) => {
            let pipeline_uuid = state.pipelines[index].uuid;

            // deleting the pipeline will also take care of running
            // sessions, runs, jobs
            makeRequest(
              "DELETE",
              `/async/pipelines/delete/${props.project_uuid}/${pipeline_uuid}`
            )
              .then((_) => {
                // reload list once removal succeeds
                fetchList(() => {
                  setState((prevState) => ({
                    ...prevState,
                    loading: false,
                    isDeleting: false,
                  }));
                });
              })
              .catch(() => {
                setState((prevState) => ({
                  ...prevState,
                  loading: false,
                  isDeleting: false,
                }));
              });
          });
        },
        () => {
          setState((prevState) => ({
            ...prevState,
            isDeleting: false,
          }));
        }
      );
    } else {
      console.error("Delete UI in progress.");
    }
  };

  const onCloseEditPipelineModal = () => {
    setState((prevState) => ({
      ...prevState,
      editPipelinePathModal: false,
      editPipelinePathModalBusy: false,
    }));
  };

  const onSubmitEditPipelinePathModal = () => {
    if (!state.editPipelinePath.endsWith(".orchest")) {
      orchest.alert("Error", "The path should end in the .orchest extension.");
      return;
    }

    setState((prevState) => ({
      ...prevState,
      editPipelinePathModalBusy: true,
    }));

    makeRequest(
      "PUT",
      `/async/pipelines/${props.project_uuid}/${state.editPipelinePathUUID}`,
      {
        type: "json",
        content: {
          path: state.editPipelinePath,
        },
      }
    )
      .then((_) => {
        fetchList(() => {
          setState((prevState) => ({
            ...prevState,
            loading: false,
          }));
        });
      })
      .catch((e) => {
        try {
          let resp = JSON.parse(e.body);

          if (resp.code == 0) {
            orchest.alert("Error", "");
          } else if (resp.code == 1) {
            orchest.alert(
              "Error",
              "Cannot change the pipeline path if an interactive session is running. Please stop it first."
            );
          } else if (resp.code == 2) {
            orchest.alert(
              "Error",
              'Cannot change the pipeline path, a file path with the name "' +
                state.editPipelinePath +
                '" already exists.'
            );
          } else if (resp.code == 3) {
            orchest.alert("Error", "The pipeline does not exist.");
          } else if (resp.code == 4) {
            orchest.alert(
              "Error",
              'The pipeline file name should end with ".orchest".'
            );
          } else if (resp.code == 5) {
            orchest.alert("Error", "The pipeline file does not exist.");
          } else if (resp.code == 6) {
            orchest.alert(
              "Error",
              "Can't move the pipeline outside of the project."
            );
          }
        } catch (error) {
          console.error(e);
          console.error(error);
        }
      })
      .finally(() => {
        onCloseEditPipelineModal();
      });
  };

  const onEditClick = (pipeline_uuid, pipeline_path) => {
    setState((prevState) => ({
      ...prevState,
      editPipelinePathUUID: pipeline_uuid,
      editPipelinePath: pipeline_path,
      editPipelinePathModal: true,
    }));
  };

  const onCreateClick = () => {
    setState((prevState) => ({
      ...prevState,
      createModal: true,
    }));
  };

  const onSubmitModal = () => {
    let pipelineName = state.createPipelineName;
    let pipelinePath = state.createPipelinePath;

    if (!pipelineName) {
      orchest.alert("Error", "Please enter a name.");
      return;
    }

    if (!pipelinePath) {
      orchest.alert("Error", "Please enter the path for the pipeline.");
      return;
    }

    if (!pipelinePath.endsWith(".orchest")) {
      orchest.alert("Error", "The path should end in the .orchest extension.");
      return;
    }

    setState((prevState) => ({
      ...prevState,
      loading: true,
    }));

    let createPipelinePromise = makeCancelable(
      makeRequest("POST", `/async/pipelines/create/${props.project_uuid}`, {
        type: "json",
        content: {
          name: pipelineName,
          pipeline_path: pipelinePath,
        },
      }),
      promiseManager
    );

    createPipelinePromise.promise
      .then((_) => {
        fetchList(() => {
          setState((prevState) => ({
            ...prevState,
            loading: false,
          }));
        });
      })
      .catch((response) => {
        if (!response.isCanceled) {
          try {
            let data = JSON.parse(response.body);

            orchest.alert(
              "Error",
              "Could not create pipeline. " + data.message
            );
          } catch {
            orchest.alert(
              "Error",
              "Could not create pipeline. Reason unknown."
            );
          }

          setState((prevState) => ({
            ...prevState,
            loading: false,
          }));
        }
      })
      .finally(() => {
        // reload list once creation succeeds
        setState((prevState) => ({
          ...prevState,
          createPipelineName: INITIAL_PIPELINE_NAME,
          createPipelinePath: INITIAL_PIPELINE_PATH,
        }));
      });

    setState((prevState) => ({
      ...prevState,
      createModal: false,
    }));
  };

  const onCancelModal = () => {
    refManager.refs.createPipelineDialog.close();
  };

  const onCloseCreatePipelineModal = () => {
    setState((prevState) => ({
      ...prevState,
      createModal: false,
      createPipelineName: INITIAL_PIPELINE_NAME,
      createPipelinePath: INITIAL_PIPELINE_PATH,
    }));
  };

  React.useEffect(() => {
    fetchList(() => {
      setState((prevState) => ({
        ...prevState,
        loading: false,
      }));
    });

    return () => promiseManager.cancelCancelablePromises();
  }, []);

  return state.loading ? (
    <div className={"pipelines-view"}>
      <h2>Pipelines</h2>
      <MDCLinearProgressReact />
    </div>
  ) : (
    <div className={"pipelines-view"}>
      {state.createModal && (
        <MDCDialogReact
          title="Create a new pipeline"
          onClose={onCloseCreatePipelineModal}
          ref={refManager.nrefs.createPipelineDialog}
          content={
            <React.Fragment>
              <MDCTextFieldReact
                classNames={["fullwidth push-down"]}
                value={state.createPipelineName}
                label="Pipeline name"
                onChange={(value) => {
                  setState((prevState) => ({
                    ...prevState,
                    createPipelinePath:
                      value.toLowerCase().replace(/[\W]/g, "_") + ".orchest",
                    createPipelineName: value,
                  }));
                }}
                data-test-id="pipeline-name-textfield"
              />
              <MDCTextFieldReact
                ref={refManager.nrefs.createPipelinePathField}
                classNames={["fullwidth"]}
                label="Pipeline path"
                onChange={(value) => {
                  setState((prevState) => ({
                    ...prevState,
                    createPipelinePath: value,
                  }));
                }}
                value={state.createPipelinePath}
                data-test-id="pipeline-path-textfield"
              />
            </React.Fragment>
          }
          actions={
            <React.Fragment>
              <MDCButtonReact
                icon="close"
                label="Cancel"
                classNames={["push-right"]}
                onClick={onCancelModal}
              />
              <MDCButtonReact
                icon="add"
                classNames={["mdc-button--raised", "themed-secondary"]}
                label="Create pipeline"
                submitButton
                onClick={onSubmitModal}
                data-test-id="pipeline-create-ok"
              />
            </React.Fragment>
          }
        />
      )}

      {state.editPipelinePathModal && (
        <MDCDialogReact
          title="Edit pipeline path"
          onClose={onCloseEditPipelineModal}
          content={
            <React.Fragment>
              <MDCTextFieldReact
                classNames={["fullwidth push-down"]}
                value={state.editPipelinePath}
                label="Pipeline path"
                initialCursorPosition={state.editPipelinePath.indexOf(
                  ".orchest"
                )}
                onChange={(value) => {
                  setState((prevState) => ({
                    ...prevState,
                    editPipelinePath: value,
                  }));
                }}
                data-test-id="pipeline-edit-path-textfield"
              />
            </React.Fragment>
          }
          actions={
            <React.Fragment>
              <MDCButtonReact
                icon="close"
                label="Cancel"
                classNames={["push-right"]}
                onClick={onCloseEditPipelineModal}
              />
              <MDCButtonReact
                icon="save"
                disabled={state.editPipelinePathModalBusy}
                classNames={["mdc-button--raised", "themed-secondary"]}
                label="Save"
                submitButton
                onClick={onSubmitEditPipelinePathModal}
                data-test-id="pipeline-edit-path-save"
              />
            </React.Fragment>
          }
        />
      )}

      <h2>Pipelines</h2>
      <div className="push-down">
        <MDCButtonReact
          classNames={["mdc-button--raised", "themed-secondary"]}
          icon="add"
          label="Create pipeline"
          onClick={onCreateClick}
          data-test-id="pipeline-create"
        />
      </div>
      <div className={"pipeline-actions push-down"}>
        <MDCIconButtonToggleReact
          icon="delete"
          tooltipText="Delete pipeline"
          disabled={state.isDeleting}
          onClick={onDeleteClick}
          data-test-id="pipeline-delete"
        />
      </div>

      <MDCDataTableReact
        ref={refManager.nrefs.pipelineListView}
        selectable
        onRowClick={onClickListItem}
        classNames={["fullwidth"]}
        headers={["Pipeline", "Path", "Session"]}
        rows={state.listData}
        data-test-id="pipelines-table"
      />
    </div>
  );
};

export default PipelineList;