const core = require("@actions/core");
const github = require("@actions/github");

try {
  const authToken = core.getInput("token");
  const repository = core.getInput("repository");
  const cacheDir = core.getInput("cachedir");

  console.log(`Repository is ${repository}`);
  console.log(`Github is ${JSON.stringify(github)}`);

} catch (error) {
  core.setFailed(error.message);
}
