require('dotenv').config();
const axios = require('axios');
const differenceBy = require('lodash.differenceby');


/**
 * Kubernetes axios instance
 */
const kubernetes = axios.create({
  baseURL: process.env.KUBERNETES_URL,
  headers: {
    Authorization: `Bearer ${process.env.KUBERNETES_TOKEN}`,
  },
});

/**
 * Healthchecks axios instance
 */
const healthchecks = axios.create({
  baseURL: `${process.env.HEALTHCHECKS_URL}/api/v1`,
  headers: {
    'X-Api-Key': process.env.HEALTHCHECKS_TOKEN,
    'Content-Type': 'application/json',
  },
});

/**
 * Fetches the cronjobs from kubernetes
 */
const getCronJobs = async () => {
  const request = await kubernetes.get('apis/batch/v1beta1/cronjobs');

  return request.data.items
    .filter((cronjob) => !cronjob.spec.suspend) // filter the cronjobs deactivated
    .map((cronjob) => {
      const id = `${cronjob.metadata.namespace}_${cronjob.metadata.name}`;

      if (!cronjob.spec.schedule.match(/^((\*\/\d+|\*|\d+)+ ?){5}$/)) {
        throw new Error(`The cronjob ${id} must be in format * * * * * instad of ${cronjob.spec.schedule}`);
      }

      return {
        name: cronjob.metadata.name,
        namespace: cronjob.metadata.namespace,
        id,
        schedule: cronjob.spec.schedule,
      };
    });
};

/**
 * 
 */
const getTests = async () => {
  const response = await healthchecks.get(`checks`);

  return response.data.checks.map((check) => {
    if (!check.schedule) {
      throw new Error(`The check ${check.name} is simple and not cron. Please delete it`);
    }

    return {
      id: check.name,
      uuid: check.ping_url.match(
        /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/
      )[0],
      schedule: check.schedule,
    };
  });
};

const getTestBody = (cronjob) => ({
  name: cronjob.id,
  schedule: cronjob.schedule,
  //tags: [cronjob.namespace],
  grace: process.env.GRACE_TIME || 300, // 5 minutes grace
  channels: '*', // Publish on all integrations
  tz: 'Europe/Paris'
});

const createTest = async (cronjob) => {
  console.log(`Create test ${cronjob.id}`);
  // The trailing slack is important !
  const response = await healthchecks.post('checks/', getTestBody(cronjob));
  
  // Ping the URL to start the healthcheck
  await axios.get(response.data.ping_url);
  
};

const updateTest = (cronjob, uuid) => {
  console.log(`Update test ${cronjob.id}`);
  // The trailing slack is important !
  return healthchecks.post(`checks/${uuid}/`, getTestBody(cronjob));
};

const deleteTest = (test) => {
  console.log(`Delete test ${test.id}`);
  // The trailing slack is important !
  return healthchecks.delete(`checks/${test.uuid}/`);
};

(async () => {
  const cronjobs = await getCronJobs();
  const tests = await getTests();

  // For kubernetes cj
  for (const cronjob of cronjobs) {
    console.log(`Test ${cronjob.id}`)
    // try to find the corresponding test
    const test = tests.find((test) => test.id === cronjob.id);

    // If the test exist
    if (test) {
      // If the schedule has changed, update it
      if (cronjob.schedule !== test.schedule) {
        await updateTest(cronjob, test.uuid);
      }
    } else {
      // If it doesn't exists, create it
      await createTest(cronjob);
    }
  }

  // Delete old tests deleted on kubernetes
  const testsToDelete = differenceBy(tests, cronjobs, 'id');

  for (const testToDelete of testsToDelete) {
    await deleteTest(testToDelete);
  }
})().catch((error) => {
  console.log(error);
  process.exit(1);
});
