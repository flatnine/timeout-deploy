async function action() {
    const core = require("@actions/core")
    const exec = require("@actions/exec")
    const github = require("@actions/github")
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

    const app_name = core.getInput(`app_name`);
    if (!app_name) {
        console.log("App Name is required");
        return; 
    }

    const action = core.getInput(`action`);
    if (!action) {
        console.log("Action is required");
        return; 
    }
    
    const domainname = core.getInput(`domainname`);
    const imageTag = core.getInput(`imageTag`);
    const graffitiSecret = core.getInput(`graffitiSecret`);
    const accountId = core.getInput(`accountId`);

    if (action === 'install') {
        
        if (!domainname) {
            console.log("domainname is required");
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
    const hostname = `www-${github.context.issue.number}.${domainname}`;
    const namespace = `pr-${github.context.issue.number}`;   
    // Location of helm chart
    const chart_path = `charts/${app_name}`;

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
                app_name,
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

            let result = await exec.exec('helm', helm_args, options);
            console.log(`exec.exec('helm', ${helm_args}, ${options})`)
            console.log(`response ${result}`)
            console.log(`Install  Deployment `)
           
        } catch(err) {
            console.log(`output ${cmdOutput}`)
            const message = `Failed to create deployment ${cmdError}`;
            await octokit.issues.createComment({
                ...github.context.repo,
                issue_number: github.context.issue.number,
                body: message,
            });
            return;
        }
        const message = `Success: http://${hostname}`;
        await octokit.issues.createComment({
            ...github.context.repo,
            issue_number: github.context.issue.number,
            body: message,
        });

    } else if (action === 'delete') {
        try {
            let result = await exec.exec('helm', ['status', app_name, '-n', namespace], options);
            console.log(`response ${result}`)
            console.log(`Deployment exists`)
            try {
                let result = await exec.exec('helm', ['delete', app_name, '-n', namespace], options);
                console.log(`response ${result}`)
                console.log(`Delete Deployment `)
            } catch(err) {
                console.log(`output ${cmdOutput}`)
                console.log(`Failed to delete deployment`)
            }
        } catch(err) {
            console.log(`output ${cmdErrorOutput}`)
            console.log(`No stack present`)
        }
        finally {
            return 
        }
    } else {
        console.log(`${action} not implemented`)
        return
    }
}

if (typeof require !== 'undefined' &&  require.main === module) {
    action();
}

module.exports = action
