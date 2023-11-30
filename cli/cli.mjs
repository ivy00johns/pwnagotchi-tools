import chalk from "chalk";
import inquirer from "inquirer";
import CLI from "clui";
import fs from "fs";
import { execSync } from "child_process";
import clipboardy from "clipboardy";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as path from "path";
import config from "../config.js";

// Get the current file and directory names
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Set the project directory
const projectDirectory = __dirname;

// CLI components
const Spinner = CLI.Spinner;

// Generate a random number
const randomNumber = Math.floor(Math.random() * 1000);

// Function to get available commands from package.json
function getAvailableCommands() {
	const packageJsonPath = "package.json";

	try {
		const packageJsonData = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
		const scripts = packageJsonData.scripts;

		if (scripts) {
			return Object.keys(scripts).map((script) => ({
				name: `${script}: ${packageJsonData.scripts[script]}`,
				value: script,
			}));
		} else {
			console.error(chalk.red("No scripts found in package.json."));
			process.exit(1);
		}
	} catch (error) {
		console.error(chalk.red(`Error reading ${packageJsonPath}: ${error.message}`));
		process.exit(1);
	}
}

// Function to run a command or copy it to clipboard
async function runCommandOrCopyToClipboard(command) {
	const {
		action
	} = await inquirer.prompt([{
		type: "list",
		name: "action",
		message: "Select an action:",
		choices: ["Execute", "Copy to Clipboard", "Cancel"],
	}]);

	if (action === "Cancel") {
		console.log(chalk.yellow("Action canceled."));
		return;
	}

	if (action === "Copy to Clipboard") {
		clipboardy.writeSync(command);
		console.log(chalk.green("Command copied to clipboard!"));
	} else if (action === "Execute") {
		console.log(chalk.blue(`Executing command: ${command}`));
		try {
			execSync(command, {
				stdio: "inherit"
			});
		} catch (error) {
			console.error(chalk.red(`Error running command: ${error.message}`));
		}
	}
}

// Function to run a command using npm
async function runCommand(command) {
	try {
		execSync(`npm run ${command}`, {
			stdio: "inherit"
		});
	} catch (error) {
		console.error(chalk.red(`Error running command: ${error.message}`));
	}
}

// Main function to handle user input and execute commands
async function run() {
	const {
		commandType
	} = await inquirer.prompt([{
		type: "list",
		name: "commandType",
		message: "Select a command type:",
		choices: ["Standard Commands", "Custom Command", "Exit"],
	}]);

	if (commandType === "Exit") {
		console.log(chalk.yellow("Goodbye!"));
		process.exit(0);
	}

	if (commandType === "Standard Commands") {
		const availableCommands = getAvailableCommands();
		const {
			command
		} = await inquirer.prompt([{
			type: "list",
			name: "command",
			message: "Select a command to run:",
			choices: [...availableCommands, {
				name: "Exit",
				value: "exit"
			}],
		}]);

		if (command !== "exit") {
			const status = new Spinner("Loading...");
			status.start();

			// Simulate an asynchronous operation
			setTimeout(() => {
				status.stop();
				console.log(chalk.green(`You selected: ${command}`));

				// Run the selected command
				runCommand(command);
			}, 500);
		}
	}

	if (commandType === "Custom Command") {
		console.log(chalk.blue("You selected Custom Command."));

		// Implement your custom command logic here
		const exclusions = [".gitkeep", ".gz"];
		const hccapxFiles = fs.readdirSync(config.LOCAL_HCCAPX_DIRECTORY).filter(file => exclusions.every(exclusion => !file.includes(exclusion)));
		const wordlistFiles = fs.readdirSync(config.LOCAL_WORLISTS_DIRECTORY).filter(file => exclusions.every(exclusion => !file.includes(exclusion)));
		const rulesFiles = fs.readdirSync(config.LOCAL_RULES_DIRECTORY).filter(file => exclusions.every(exclusion => !file.includes(exclusion)));

		if (hccapxFiles.length === 0) {
			console.log(chalk.yellow("No hccapx .hc22000 files found. Please run 'npm run generate'."));
			process.exit(0);
		}

		const {
			selectedHccapx
		} = await inquirer.prompt([{
			type: "list",
			name: "selectedHccapx",
			message: "Select an hccapx file:",
			choices: [...hccapxFiles],
		}]);

		const {
			selectedWordlist
		} = await inquirer.prompt([{
			type: "list",
			name: "selectedWordlist",
			message: "Select a wordlist file:",
			choices: [...wordlistFiles, "NONE"],
		}]);

		const {
			selectedRules
		} = await inquirer.prompt([{
			type: "list",
			name: "selectedRules",
			message: "Select a rules file:",
			choices: [...rulesFiles, "NONE"],
		}]);

		// Generate and display the custom command
		const customCommand = generateCustomCommand(selectedHccapx, selectedWordlist, selectedRules);
		console.log(chalk.green(`Generated Custom Command: ${customCommand}`));

		// Prompt the user to execute or copy the command to clipboard
		await runCommandOrCopyToClipboard(customCommand);
	}
}

// Function to generate a custom command based on user selections
function generateCustomCommand(hccapx, wordlist, rules) {
	const sessionBaseName = hccapx.replace(/\.hc22000$/, "");
	const ruleName = rules.replace(/\.txt$/, "");
	const wordlistName = wordlist.replace(/\.txt$/, "");
	const sessionName  = `${sessionBaseName}-${randomNumber}`;

	const wordlistPath = `${path.join(projectDirectory, "..", config.LOCAL_WORLISTS_DIRECTORY, wordlistName)}.txt`;
	const rulePath     = `${path.join(projectDirectory, "..", config.LOCAL_RULES_DIRECTORY, ruleName)}`;
	const outputPath   = `${path.join(projectDirectory, "..", config.LOCAL_OUTPUT_FILE_DIRECTORY, `${sessionName}-output.txt`)}`;
	const potfilePath  = `${path.join(projectDirectory, "..", config.LOCAL_POTFILES_DIRECTORY, `${sessionName}-potfile.txt`)}`;
	const hccapxPath   = `${path.join(projectDirectory, "..", config.LOCAL_HCCAPX_DIRECTORY, hccapx)}`;

	if (wordlist !== "NONE" && rules !== "NONE") {
		return `hashcat --hash-type=${config.HASH_TYPE} --attack-mode=0 --session ${sessionName} --hwmon-temp-abort=${config.ABORT_TEMPERATURE} -w ${config.ABORT_WAIT_TIME} --potfile-path "${potfilePath}" --outfile="${outputPath}" "${hccapxPath}" --rules-file="${rulePath}" -S "${wordlistPath}"`;
	} else if (wordlist === "NONE" && rules !== "NONE") {
		return `hashcat --hash-type=${config.HASH_TYPE} --attack-mode=0 --session ${sessionName} --hwmon-temp-abort=${config.ABORT_TEMPERATURE} -w ${config.ABORT_WAIT_TIME} --potfile-path "${potfilePath}" --outfile="${outputPath}" "${hccapxPath}" --rules-file="${rulePath}"`;
	} else if (wordlist !== "NONE" && rules === "NONE") {
		return `hashcat --hash-type=${config.HASH_TYPE} --attack-mode=0 --session ${sessionName} --hwmon-temp-abort=${config.ABORT_TEMPERATURE} -w ${config.ABORT_WAIT_TIME} --potfile-path "${potfilePath}" --outfile="${outputPath}" "${hccapxPath}" -S "${wordlistPath}"`
	} else {
		console.log(`No command present.`);
	}
}

// Run the main function
run();
