async function action() {
    const core = require("@actions/core")
    const exec = require("@actions/exec")
    const github = require("@actions/github")
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

    const appName = core.getInput(`appName`);
    if (!appName) {
        console.log("App Name is required");
        return; 
    }

    const action = core.getInput(`action`);
    if (!action) {
        console.log("Action is required");
        return; 
    }
    
    const domainName = core.getInput(`domainName`);
    const imageTag = core.getInput(`imageTag`);
    const graffitiSecret = core.getInput(`graffitiSecret`);
    const accountId = core.getInput(`accountId`);

    if (action === 'install') {
        
        if (!domainName) {
            console.log("domainName is required");
            return; 
        }

        if (!imageTag) {
            console.log("imageTag is required");
            return; 
        }
        
        if (!graffitiSecret) {
            console.log("graffitiSecret is required");
            return; 
        }

        if (!accountId) {
            console.log("accountId is required");
            return; 
        }
    }
    
    // hostname that will resolve to deployment 
    const hostname = `www-${github.context.issue.number}.${domainName}`;
    const namespace = `pr-${github.context.issue.number}`;   
    // Location of helm chart
    const chart_path = `charts/${appName}`;

    let cmdOutput = '';
    let cmdError = '';

    const options = {};
    options.listeners = {
        stdout: (data) => {
            cmdOutput += data.toString();
        },
        stderr: (data) => {
            cmdError += data.toString();
        }
    };
    
    if (action === 'install') {
        
        try {

            const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE;
            const helm_args = [
                'upgrade', 
                appName,
                '--install', 
                '--wait', 
                '--create-namespace', 
                '-n', 
                namespace,
                `${GITHUB_WORKSPACE}/${chart_path}`,
                "-f",
                `${GITHUB_WORKSPACE}/${chart_path}/values.yaml`,
                "--set",
                `ingress.hostname=${hostname}`,
                "--set",
                `"ingress\.annotations\.external\-dns\.alpha\.kubernetes\.io\/hostname"=${hostname}`,
                "--set",
                `graffiti.client_secret=${graffitiSecret}`,
                "--set",
                `image.tag=${imageTag}`,
                "--set",
                `image.repository=${accountId}.dkr.ecr.eu-west-1.amazonaws.com/gp-web`
            ] 

            await exec.exec('helm', helm_args, options);
            console.log(`Install  Deployment `)
           
        } catch(err) {
            console.log(`output ${cmdOutput}`)
            core.setOutput("output", cmdError);
            await octokit.issues.createComment({
                ...github.context.repo,
                issue_number: github.context.issue.number,
                body: `Failed to create deployment ${cmdError}`,
            });
            return;
        }
        
        core.setOutput("output", cmdOutput);
        await octokit.issues.createComment({
            ...github.context.repo,
            issue_number: github.context.issue.number,
            body: `Success: http://${hostname}`,
        });

    } else if (action === 'delete') {
        try {
            await exec.exec('helm', ['status', appName, '-n', namespace], options);
            console.log(`Deployment exists`)
            try {
                await exec.exec('helm', ['delete', appName, '-n', namespace], options);
                console.log(`Delete Deployment `)
            } catch(err) {
                console.log(`output ${cmdError}`)
                core.setOutput("output", cmdError);
                console.log(`Failed to delete deployment`)
                return
            }
        } catch(err) {
            console.log(`output ${cmdError}`)
            core.setOutput("output", cmdError);
            console.log(`No stack present`)
            return 
        }
        core.setOutput("output", cmdOutput);
        return 
        
    } else {
        console.log(`${action} not implemented`)
        core.setOutput("output", `${action} not implemented`);
        return
    }
}

if (typeof require !== 'undefined' &&  require.main === module) {
    action();
}

module.exports = action
