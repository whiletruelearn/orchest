import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import CronScheduleInput from "@/components/CronScheduleInput";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import DateTimeInput from "@/components/DateTimeInput";
import EnvVarList, { EnvVarPair } from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParameterEditor from "@/components/ParameterEditor";
import { NoParameterAlert } from "@/components/ParamTree";
import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type { Job, Json, PipelineJson, StrategyJson } from "@/types";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  getPipelineJSONEndpoint,
  isValidEnvironmentVariableName,
} from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import ListIcon from "@mui/icons-material/List";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TuneIcon from "@mui/icons-material/Tune";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { fetcher, HEADER } from "@orchest/lib-utils";
import parser from "cron-parser";
import _ from "lodash";
import React from "react";
import useSWR from "swr";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(3, 0),
}));

const DEFAULT_CRON_STRING = "* * * * *";

type ScheduleOption = "now" | "cron" | "scheduled";

// TODO: should be converted to map/reduce style
function recursivelyGenerate(
  params: Record<string, Record<string, Json>>,
  accum: any[],
  unpacked: any[]
) {
  // deep clone unpacked
  unpacked = JSON.parse(JSON.stringify(unpacked));

  for (const fullParam in params) {
    if (unpacked.indexOf(fullParam) === -1) {
      unpacked.push(fullParam);

      for (const idx in params[fullParam]) {
        // deep clone params
        let localParams = JSON.parse(JSON.stringify(params));

        // collapse param list to paramValue
        localParams[fullParam] = params[fullParam][idx];

        recursivelyGenerate(localParams, accum, unpacked);
      }
      return;
    }
  }

  accum.push(params);
}

const generateJobParameters = (
  generatedPipelineRuns: Record<string, Json>[],
  selectedIndices: string[]
) => {
  return selectedIndices.map((index) => {
    const runParameters = generatedPipelineRuns[index];
    return Object.entries(runParameters).reduce((all, [key, value]) => {
      // key is formatted: <stepUUID>#<parameterKey>
      let keySplit = key.split("#");
      let stepUUID = keySplit[0];
      let parameterKey = keySplit.slice(1).join("#");

      // check if step already exists,
      const parameter = all[stepUUID] || {};
      parameter[parameterKey] = value;

      return { ...all, [stepUUID]: parameter };
    }, {});
  });
};

const findParameterization = (
  parameterization: Record<string, any>,
  parameters: Record<string, Json>[]
) => {
  let JSONstring = JSON.stringify(parameterization);
  for (let x = 0; x < parameters.length; x++) {
    if (JSON.stringify(parameters[x]) === JSONstring) {
      return x;
    }
  }
  return -1;
};

const parseParameters = (
  parameters: Record<string, Json>[],
  generatedPipelineRuns: Record<string, Json>[]
) => {
  let _parameters = _.cloneDeep(parameters);
  let selectedIndices = new Set<string>();
  generatedPipelineRuns.forEach((run, index) => {
    let encodedParameterization = generateJobParameters([run], ["0"])[0];

    let needleIndex = findParameterization(
      encodedParameterization,
      _parameters
    );
    if (needleIndex >= 0) {
      selectedIndices.add(index.toString());
      // remove found parameterization from _parameters, as to not count duplicates
      _parameters.splice(needleIndex, 1);
    } else {
      selectedIndices.delete(index.toString());
    }
  });

  return Array.from(selectedIndices);
};

const generateWithStrategy = (
  pipelineName: string,
  strategyJSON: Record<string, { parameters: Record<string, string> }>
) => {
  // flatten and JSONify strategyJSON to prep data structure for algo
  let flatParameters = {};

  for (const strategyJSONKey in strategyJSON) {
    for (const paramKey in strategyJSON[strategyJSONKey].parameters) {
      let fullParam = strategyJSONKey + "#" + paramKey;

      flatParameters[fullParam] = JSON.parse(
        strategyJSON[strategyJSONKey].parameters[paramKey]
      );
    }
  }

  let pipelineRuns: Record<string, Json>[] = [];

  recursivelyGenerate(flatParameters, pipelineRuns, []);

  // transform pipelineRuns for generatedPipelineRunRows DataTable format
  const pipelineRunRows: PipelineRunRow[] = pipelineRuns.map(
    (params: Record<string, Json>, index: number) => {
      const pipelineRunSpec = Object.entries(params).map(
        ([fullParam, value]) => {
          // pipeline_parameters#something#another_something: "some-value"
          let paramName = fullParam.split("#").slice(1).join("");
          return `${paramName}: ${JSON.stringify(value)}`;
        }
      );

      return {
        uuid: index.toString(),
        spec: pipelineRunSpec.join(", ") || "Parameterless run",
        details: (
          <Stack
            direction="column"
            alignItems="flex-start"
            sx={{ padding: (theme) => theme.spacing(2, 1) }}
          >
            {pipelineRunSpec.length === 0 ? (
              <NoParameterAlert />
            ) : (
              <>
                <Typography variant="body2">{pipelineName}</Typography>
                {pipelineRunSpec.map((param, index) => (
                  <Typography
                    variant="caption"
                    key={index}
                    sx={{ paddingLeft: (theme) => theme.spacing(1) }}
                  >
                    {param}
                  </Typography>
                ))}
              </>
            )}
          </Stack>
        ),
      };
    }
  );

  return { pipelineRuns, pipelineRunRows };
};

type PipelineRunRow = { uuid: string; spec: string; details: React.ReactNode };
const columns: DataTableColumn<PipelineRunRow>[] = [
  {
    id: "spec",
    label: "Run specification",
    render: function RunSpec(row) {
      return row.spec === "Parameterless run" ? <i>{row.spec}</i> : row.spec;
    },
  },
];

const generateParameterLists = (parameters: Record<string, Json>) => {
  let parameterLists = {};

  for (const paramKey in parameters) {
    // Note: the list of parameters for each key will always be
    // a string in the 'strategyJSON' data structure. This
    // facilitates preserving user added indendation.

    // Validity of the user string as JSON is checked client
    // side (for now).
    parameterLists[paramKey] = JSON.stringify([parameters[paramKey]]);
  }

  return parameterLists;
};

const generateStrategyJson = (pipeline: PipelineJson, reservedKey: string) => {
  let strategyJSON = {};

  if (pipeline.parameters && Object.keys(pipeline.parameters).length > 0) {
    strategyJSON[reservedKey] = {
      key: reservedKey,
      parameters: generateParameterLists(pipeline.parameters),
      title: pipeline.name,
    };
  }

  for (const stepUUID in pipeline.steps) {
    let stepStrategy = JSON.parse(JSON.stringify(pipeline.steps[stepUUID]));

    if (
      stepStrategy.parameters &&
      Object.keys(stepStrategy.parameters).length > 0
    ) {
      // selectively persist only required fields for use in parameter
      // related React components
      strategyJSON[stepUUID] = {
        key: stepUUID,
        parameters: generateParameterLists(stepStrategy.parameters),
        title: stepStrategy.title,
      };
    }
  }

  return strategyJSON;
};

const EditJobView: React.FC = () => {
  // global states
  const appContext = useAppContext();
  const { setAlert, setAsSaved } = appContext;
  useSendAnalyticEvent("view load", { name: siteMap.editJob.path });

  // data from route
  const { projectUuid, jobUuid, navigateTo } = useCustomRoute();

  // local states
  const [cronString, setCronString] = React.useState("");
  const [scheduledDateTime, setScheduledDateTime] = React.useState<Date>(
    new Date(new Date().getTime() + 60000)
  );
  const [scheduleOption, setScheduleOption] = React.useState<ScheduleOption>(
    "now"
  );

  const [envVariables, _setEnvVariables] = React.useState<EnvVarPair[]>([]);
  const setEnvVariables = (value: React.SetStateAction<EnvVarPair[]>) => {
    _setEnvVariables(value);
    setAsSaved(false);
  };

  const [tabIndex, setTabIndex] = React.useState(0);

  const [pipelineRunRows, setPipelineRunRows] = React.useState<
    PipelineRunRow[]
  >([]);
  const [pipelineRuns, setPipelineRuns] = React.useState<
    Record<string, Json>[]
  >([]);
  const [selectedRuns, setSelectedRuns] = React.useState<string[]>([]);

  const [runJobLoading, setRunJobLoading] = React.useState(false);

  const {
    data: job,
    revalidate: fetchJob,
    error: fetchJobError,
    isValidating: isFetchingJob,
    mutate: setJob,
  } = useSWR<Job>(`/catch/api-proxy/api/jobs/${jobUuid}`, fetcher);

  const {
    data: pipeline,
    error: fetchPipelineError,
    isValidating: isFetchingPipeline,
  } = useSWR<PipelineJson>(
    projectUuid && job
      ? getPipelineJSONEndpoint(job.pipeline_uuid, projectUuid, job.uuid)
      : null,
    (url) =>
      fetcher<{
        pipeline_json: string;
        success: boolean;
      }>(url).then((result) => {
        if (result.success) {
          const fetchedPipeline: PipelineJson = JSON.parse(
            result.pipeline_json
          );
          return fetchedPipeline;
        } else {
          throw new Error("Could not load pipeline.json");
        }
      })
  );

  const isLoading = isFetchingJob || isFetchingPipeline;

  const [strategyJson, setStrategyJson] = React.useState<StrategyJson>(null);

  React.useEffect(() => {
    if (job) {
      _setEnvVariables(envVariablesDictToArray(job.env_variables));
      setScheduleOption(!job.schedule ? "now" : "cron");
      setCronString(job.schedule || DEFAULT_CRON_STRING);
      setStrategyJson((prev) =>
        job.status !== "DRAFT" ? job.strategy_json : prev
      );
      if (job.status === "DRAFT") {
        setAsSaved(false);
      }
    }
  }, [job, setAsSaved]);

  React.useEffect(() => {
    if (job && pipeline) {
      // Do not generate another strategy_json if it has been defined
      // already.
      const reserveKey =
        appContext.state.config?.PIPELINE_PARAMETERS_RESERVED_KEY || "";
      const generatedStrategyJson =
        job.status === "DRAFT" && Object.keys(job.strategy_json).length === 0
          ? generateStrategyJson(pipeline, reserveKey)
          : job.strategy_json;

      setStrategyJson(generatedStrategyJson);

      const generated = generateWithStrategy(
        pipeline?.name,
        generatedStrategyJson
      );

      // Account for the fact that a job might have a list of
      // parameters already defined, i.e. when editing a non draft
      // job or when duplicating a job.
      // if fetchedJob has no set parameters, we select all parameters as default
      setSelectedRuns(
        job.parameters.length > 0
          ? parseParameters(job.parameters, generated.pipelineRuns)
          : generated.pipelineRunRows.map((run) => run.uuid)
      );
      setPipelineRuns(generated.pipelineRuns);
      setPipelineRunRows(generated.pipelineRunRows);
    }
  }, [
    job,
    pipeline,
    appContext.state.config?.PIPELINE_PARAMETERS_RESERVED_KEY,
  ]);

  const handleJobNameChange = (name: string) => {
    setJob((prev) => (prev ? { ...prev, name } : prev), false);
    setAsSaved(false);
  };

  const validateJobConfig = () => {
    // At least one selected pipeline run.
    if (selectedRuns.length === 0) {
      return {
        pass: false,
        selectView: 3,
        reason:
          "You selected 0 pipeline runs. Please choose at least one pipeline run configuration.",
      };
    }

    // Valid cron string.
    try {
      parser.parseExpression(cronString || "");
    } catch (err) {
      return {
        pass: false,
        selectView: 0,
        reason: "Invalid cron schedule: " + cronString,
      };
    }

    // Valid environment variables
    for (let envPair of envVariables) {
      if (!isValidEnvironmentVariableName(envPair.name)) {
        return {
          pass: false,
          selectView: 2,
          reason: 'Invalid environment variable name: "' + envPair.name + '"',
        };
      }
    }

    return { pass: true };
  };

  const attemptRunJob = () => {
    // validate job configuration
    let validation = validateJobConfig();
    if (validation.pass === true) {
      runJob();
    } else {
      setAlert("Error", validation.reason);
      if (validation.selectView !== undefined) {
        setTabIndex(validation.selectView);
      }
    }
  };

  const { run, error: putJobError } = useAsync<void>();

  React.useEffect(() => {
    if (putJobError) {
      setAlert("Error", `Failed to modify job. ${putJobError.message}`);
    }
  }, [putJobError, setAlert]);

  const runJob = async () => {
    if (!job) return;

    setRunJobLoading(true);
    setAsSaved();

    let updatedEnvVariables = envVariablesArrayToDict(envVariables);
    // Do not go through if env variables are not correctly defined.
    if (updatedEnvVariables.status === "rejected") {
      setAlert("Error", updatedEnvVariables.error);
      setRunJobLoading(false);
      setTabIndex(1);
      return;
    }

    let jobPUTData = {
      name: job.name,
      confirm_draft: true,
      strategy_json: strategyJson,
      parameters: generateJobParameters(pipelineRuns, selectedRuns),
      env_variables: updatedEnvVariables.value,
    };

    if (scheduleOption === "scheduled") {
      let formValueScheduledStart = scheduledDateTime.toISOString();

      // API doesn't accept ISO date strings with 'Z' suffix
      // Instead, endpoint assumes its passed a UTC datetime string.
      if (formValueScheduledStart[formValueScheduledStart.length - 1] === "Z") {
        formValueScheduledStart = formValueScheduledStart.slice(
          0,
          formValueScheduledStart.length - 1
        );
      }

      // @ts-ignore
      jobPUTData.next_scheduled_time = formValueScheduledStart;
    } else if (scheduleOption === "cron") {
      // @ts-ignore
      jobPUTData.cron_schedule = cronString;
    }
    // Else: both entries are undefined, the run is considered to be
    // started ASAP.

    // Update orchest-api through PUT.
    // Note: confirm_draft will trigger the start the job.

    run(
      fetcher<void>(`/catch/api-proxy/api/jobs/${job.uuid}`, {
        method: "PUT",
        headers: HEADER.JSON,
        body: JSON.stringify(jobPUTData),
      }).finally(() => {
        setAsSaved();
        if (projectUuid)
          navigateTo(siteMap.jobs.path, {
            query: { projectUuid },
          });
      })
    );
  };

  const putJobChanges = () => {
    if (!job || !projectUuid) return;
    /* This function should only be called
     *  for jobs with a cron schedule. As those
     *  are the only ones that are allowed to be changed
     *  when they are not a draft.
     */

    // validate job configuration
    let validation = validateJobConfig();
    if (validation.pass === true) {
      let jobParameters = generateJobParameters(pipelineRuns, selectedRuns);

      let updatedEnvVariables = envVariablesArrayToDict(envVariables);
      // Do not go through if env variables are not correctly defined.
      if (updatedEnvVariables.status === "rejected") {
        setAlert("Error", updatedEnvVariables.error);
        setTabIndex(2);
        return;
      }

      setAsSaved();

      run(
        fetcher(`/catch/api-proxy/api/jobs/${job.uuid}`, {
          method: "PUT",
          headers: HEADER.JSON,
          body: JSON.stringify({
            name: job.name,
            cron_schedule: cronString,
            parameters: jobParameters,
            strategy_json: strategyJson,
            env_variables: updatedEnvVariables.value,
          }),
        }).then(() => {
          navigateTo(siteMap.job.path, {
            query: {
              projectUuid,
              jobUuid: job.uuid,
            },
          });
        })
      );
    } else {
      setAlert("Error", validation.reason);
      if (validation.selectView !== undefined) {
        setTabIndex(validation.selectView);
      }
    }
  };

  const cancel = () => {
    if (projectUuid)
      navigateTo(siteMap.jobs.path, {
        query: { projectUuid },
      });
  };

  const setCronSchedule = (newCronString: string) => {
    setCronString(newCronString);
    setScheduleOption("cron");
    setAsSaved(false);
  };

  React.useEffect(() => {
    fetchJob();
  }, []);

  const handleChangeTab = (
    event: React.SyntheticEvent<Element, Event>,
    newValue: number
  ) => {
    setTabIndex(newValue);
  };

  const tabs = React.useMemo(() => {
    return [
      {
        id: "scheduling",
        label: "Scheduling",
        icon: <ScheduleIcon />,
      },
      {
        id: "parameters",
        label: "Parameters",
        icon: <TuneIcon />,
      },
      {
        id: "environment-variables",
        label: "Environment variables",
        icon: <ViewComfyIcon />,
      },
      {
        id: "runs",
        label: `Pipeline runs (${selectedRuns.length}/${pipelineRuns.length})`,
        icon: <ListIcon />,
      },
    ];
  }, [selectedRuns, pipelineRuns.length]);

  return (
    <Layout fullHeight>
      <Stack direction="column" sx={{ height: "100%" }}>
        <Typography variant="h5">Edit job</Typography>
        {job && pipeline ? (
          <>
            <Stack
              direction="row"
              flexWrap="wrap"
              sx={{ width: "100%", marginTop: (theme) => theme.spacing(4) }}
            >
              <Box
                sx={{
                  flex: 1,
                  minWidth: "300px",
                  marginBottom: (theme) => theme.spacing(4),
                }}
              >
                <TextField
                  label="Job name"
                  value={job.name}
                  onChange={(e) => handleJobNameChange(e.target.value)}
                />
              </Box>
              <Stack
                direction="column"
                sx={{
                  flex: 1,
                  minWidth: "300px",
                  marginBottom: (theme) => theme.spacing(4),
                }}
              >
                <Typography variant="caption">Pipeline</Typography>
                <Typography>{pipeline.name}</Typography>
              </Stack>
            </Stack>
            <Tabs
              value={tabIndex}
              onChange={handleChangeTab}
              label="Edit Job Tabs"
              data-test-id="job-edit"
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  id={tab.id}
                  label={<TabLabel icon={tab.icon}>{tab.label}</TabLabel>}
                  aria-controls={tab.id}
                  data-test-id={`${tab.id}-tab`}
                />
              ))}
            </Tabs>
            <CustomTabPanel value={tabIndex} index={0} name="scheduling">
              {job.status === "DRAFT" && (
                <FormControl
                  component="fieldset"
                  sx={{
                    marginBottom: (theme) => theme.spacing(4),
                    width: "100%",
                  }}
                >
                  <RadioGroup
                    row
                    aria-label="Scheduling"
                    defaultValue="now"
                    name="scheduling-buttons-group"
                    value={scheduleOption}
                    onChange={(e) =>
                      setScheduleOption(e.target.value as ScheduleOption)
                    }
                  >
                    <FormControlLabel
                      value="now"
                      control={<Radio />}
                      label="Now"
                      data-test-id="job-edit-schedule-now"
                    />
                    <FormControlLabel
                      value="scheduled"
                      control={<Radio />}
                      label="Scheduled"
                      data-test-id="job-edit-schedule-date"
                    />
                    <FormControlLabel
                      value="cron"
                      control={<Radio />}
                      label="Cron job"
                      data-test-id="job-edit-schedule-cronjob"
                    />
                  </RadioGroup>
                </FormControl>
              )}
              {scheduleOption === "scheduled" && (
                <DateTimeInput
                  disabled={scheduleOption !== "scheduled"}
                  value={scheduledDateTime}
                  onChange={setScheduledDateTime}
                />
              )}
              {scheduleOption === "cron" && (
                <CronScheduleInput
                  value={cronString}
                  onChange={setCronSchedule}
                  disabled={scheduleOption !== "cron"}
                  dataTestId="job-edit-schedule-cronjob-input"
                />
              )}
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={1} name="parameters">
              <ParameterEditor
                pipelineName={pipeline.name}
                onParameterChange={(value: StrategyJson) => {
                  const generated = generateWithStrategy(pipeline.name, value);

                  setPipelineRuns(generated.pipelineRuns);
                  setPipelineRunRows(generated.pipelineRunRows);

                  setSelectedRuns(
                    generated.pipelineRunRows.map((row) => row.uuid)
                  );
                  setStrategyJson(value);

                  setAsSaved(false);
                }}
                strategyJSON={strategyJson}
                data-test-id="job-edit"
              />
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={2} name="env-variables">
              <p className="push-down">
                Override any project or pipeline environment variables here.
              </p>
              <EnvVarList
                value={envVariables}
                setValue={setEnvVariables}
                data-test-id="job-edit"
              />
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={3} name="runs">
              <div className="pipeline-tab-view pipeline-runs">
                <DataTable<PipelineRunRow>
                  selectable
                  id="job-edit-pipeline-runs"
                  columns={columns}
                  isLoading={isLoading}
                  initialSelectedRows={pipelineRunRows.map(
                    (pipelineRunRow) => pipelineRunRow.uuid
                  )}
                  selectedRows={selectedRuns}
                  setSelectedRows={setSelectedRuns}
                  onChangeSelection={() => setAsSaved(false)}
                  rows={pipelineRunRows}
                  data-test-id="job-edit-pipeline-runs"
                />
              </div>
            </CustomTabPanel>
            <Stack direction="row" spacing={2}>
              {job.status === "DRAFT" && (
                <Button
                  disabled={runJobLoading || !job.name}
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={attemptRunJob}
                  data-test-id="job-run"
                >
                  Run job
                </Button>
              )}
              {job.status !== "DRAFT" && (
                <Button
                  variant="contained"
                  onClick={putJobChanges}
                  startIcon={<SaveIcon />}
                  data-test-id="job-update"
                >
                  Update job
                </Button>
              )}
              <Button
                onClick={cancel}
                startIcon={<CloseIcon />}
                color="secondary"
                data-test-id="update-job"
              >
                Cancel
              </Button>
            </Stack>
          </>
        ) : (
          <LinearProgress />
        )}
      </Stack>
    </Layout>
  );
};

export default EditJobView;
