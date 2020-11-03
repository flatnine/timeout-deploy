async function action() {
    const { stripIndent } = require("common-tags")

    const core = require("@actions/core")
    const exec = require("@actions/exec")
    const github = require("@actions/github")


    const chart_path = "charts/gp-web"

    const app_name = core.getInput(`app_name`);
    if (!app_name) {
        console.log("App Name is required");
        return; 
    }

    const command = core.getInput(`command`);
    if (!command) {
        console.log("Command is required");
        return; 
    }

    const namespace = core.getInput(`namespace`);
    if (!namespace) {
        console.log("namespace is required");
        return; 
    }
   
    const hostname = core.getInput(`hostname`);
    const imageTag = core.getInput(`imageTag`);
    const graffitiSecret = core.getInput(`graffitiSecret`);
    const accountId = core.getInput(`accountId`);
    
    
    if (command === 'install') {
        if (!hostname) {
            console.log("hostname is required");
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

    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);


    console.log(`echo ${command} ${namespace} ${app_name}`)

    let myOutput = '';
    let myError = '';
    let myCode = 0;

    const options = {};
    options.listeners = {
        exec: (code) => {
            myCode = code
        },
        stdout: (data) => {
            myOutput += data.toString();
        },
        stderr: (data) => {
            myError += data.toString();
        }
    };
    
    if (command === 'install') {
        
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
            console.log(`output ${myOutput}`)
            const message = `Failed to create deployment ${myError}`;
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

    } else if (command === 'delete') {
        try {
            let result = await exec.exec('helm', ['status', app_name, '-n', namespace], options);
            console.log(`response ${result}`)
            console.log(`Deployment exists`)
            try {
                let result = await exec.exec('helm', ['delete', app_name, '-n', namespace], options);
                console.log(`response ${result}`)
                console.log(`Delete Deployment `)
            } catch(err) {
                console.log(`output ${myOutput}`)
                console.log(`Failed to delete deployment`)
            }
        } catch(err) {
            console.log(`output ${myOutput}`)
            console.log(`No stack present`)
        }
        finally {
            return 
        }
    } else {
        console.log(`${command} not valid`)
        return
    }

    
}

if (typeof require !== 'undefined' &&  require.main === module) {
    action();
}

module.exports = action