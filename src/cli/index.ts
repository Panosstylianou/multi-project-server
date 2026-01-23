#!/usr/bin/env node
/* eslint-disable no-console */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { projectManager } from '../services/project-manager.js';

const program = new Command();

program
  .name('pbm')
  .description('PocketBase Multi-Project Manager CLI')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize the PocketBase manager')
  .action(async () => {
    const spinner = ora('Initializing PocketBase Manager...').start();
    try {
      await projectManager.initialize();
      spinner.succeed('PocketBase Manager initialized successfully');
    } catch (error) {
      spinner.fail(`Initialization failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Create project command
program
  .command('create')
  .description('Create a new PocketBase project')
  .option('-n, --name <name>', 'Project name')
  .option('-s, --slug <slug>', 'Project slug (auto-generated if not provided)')
  .option('-d, --description <desc>', 'Project description')
  .option('-c, --client <name>', 'Client name')
  .option('-e, --email <email>', 'Client email')
  .option('--memory <limit>', 'Memory limit (e.g., 256m, 1g)', '256m')
  .option('--cpu <limit>', 'CPU limit (e.g., 0.5, 1)', '0.5')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (options) => {
    try {
      await projectManager.initialize();

      let projectInput;

      if (options.interactive || !options.name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Project name:',
            default: options.name,
            validate: (input: string) => input.length > 0 || 'Name is required',
          },
          {
            type: 'input',
            name: 'slug',
            message: 'Project slug (leave empty for auto):',
            default: options.slug,
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description:',
            default: options.description,
          },
          {
            type: 'input',
            name: 'clientName',
            message: 'Client name:',
            default: options.client,
          },
          {
            type: 'input',
            name: 'clientEmail',
            message: 'Client email:',
            default: options.email,
          },
        ]);
        projectInput = answers;
      } else {
        projectInput = {
          name: options.name,
          slug: options.slug,
          description: options.description,
          clientName: options.client,
          clientEmail: options.email,
        };
      }

      projectInput.config = {
        memoryLimit: options.memory,
        cpuLimit: options.cpu,
      };

      const spinner = ora(`Creating project "${projectInput.name}"...`).start();

      const project = await projectManager.createProject(projectInput);
      const url = await projectManager.getProjectUrl(project.id);
      const adminUrl = await projectManager.getProjectAdminUrl(project.id);

      spinner.succeed(`Project "${project.name}" created successfully!`);

      console.log('');
      console.log(chalk.bold('Project Details:'));
      console.log(`  ${chalk.gray('ID:')}       ${project.id}`);
      console.log(`  ${chalk.gray('Slug:')}     ${project.slug}`);
      console.log(`  ${chalk.gray('Status:')}   ${chalk.green(project.status)}`);
      console.log(`  ${chalk.gray('Port:')}     ${project.port}`);
      console.log('');
      console.log(chalk.bold('URLs:'));
      console.log(`  ${chalk.gray('API:')}      ${chalk.cyan(url)}`);
      console.log(`  ${chalk.gray('Admin:')}    ${chalk.cyan(adminUrl)}`);
      console.log('');
      console.log(chalk.yellow('Note: Visit the admin URL to set up your admin account'));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// List projects command
program
  .command('list')
  .alias('ls')
  .description('List all projects')
  .option('-s, --status <status>', 'Filter by status (running, stopped, error)')
  .option('--client <name>', 'Filter by client name')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      await projectManager.initialize();

      const projects = await projectManager.listProjects({
        status: options.status,
        clientName: options.client,
      });

      if (options.json) {
        console.log(JSON.stringify(projects, null, 2));
        return;
      }

      if (projects.length === 0) {
        console.log(chalk.yellow('No projects found'));
        return;
      }

      console.log('');
      console.log(chalk.bold(`Projects (${projects.length}):`));
      console.log('');

      for (const project of projects) {
        const statusColor =
          project.status === 'running'
            ? chalk.green
            : project.status === 'stopped'
            ? chalk.yellow
            : chalk.red;

        console.log(
          `  ${chalk.bold(project.name)} ${chalk.gray(`(${project.slug})`)}  ${statusColor(project.status)}`
        );
        console.log(`    ${chalk.gray('ID:')} ${project.id}  ${chalk.gray('Port:')} ${project.port}`);
        if (project.clientName) {
          console.log(`    ${chalk.gray('Client:')} ${project.clientName}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Get project details
program
  .command('info <project>')
  .description('Get project details')
  .option('--json', 'Output as JSON')
  .action(async (projectIdOrSlug, options) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      if (options.json) {
        const url = await projectManager.getProjectUrl(project.id);
        const adminUrl = await projectManager.getProjectAdminUrl(project.id);
        console.log(JSON.stringify({ ...project, urls: { api: url, admin: adminUrl } }, null, 2));
        return;
      }

      const url = await projectManager.getProjectUrl(project.id);
      const adminUrl = await projectManager.getProjectAdminUrl(project.id);

      const statusColor =
        project.status === 'running'
          ? chalk.green
          : project.status === 'stopped'
          ? chalk.yellow
          : chalk.red;

      console.log('');
      console.log(chalk.bold(`Project: ${project.name}`));
      console.log('');
      console.log(`  ${chalk.gray('ID:')}          ${project.id}`);
      console.log(`  ${chalk.gray('Slug:')}        ${project.slug}`);
      console.log(`  ${chalk.gray('Status:')}      ${statusColor(project.status)}`);
      console.log(`  ${chalk.gray('Port:')}        ${project.port}`);
      console.log(`  ${chalk.gray('Container:')}   ${project.containerName}`);
      console.log(`  ${chalk.gray('Created:')}     ${project.createdAt.toISOString()}`);
      console.log(`  ${chalk.gray('Updated:')}     ${project.updatedAt.toISOString()}`);
      console.log('');
      if (project.description) {
        console.log(`  ${chalk.gray('Description:')} ${project.description}`);
      }
      if (project.clientName) {
        console.log(`  ${chalk.gray('Client:')}      ${project.clientName}`);
      }
      if (project.clientEmail) {
        console.log(`  ${chalk.gray('Email:')}       ${project.clientEmail}`);
      }
      console.log('');
      console.log(chalk.bold('URLs:'));
      console.log(`  ${chalk.gray('API:')}         ${chalk.cyan(url)}`);
      console.log(`  ${chalk.gray('Admin:')}       ${chalk.cyan(adminUrl)}`);
      console.log('');
      console.log(chalk.bold('Config:'));
      console.log(`  ${chalk.gray('Memory:')}      ${project.config.memoryLimit}`);
      console.log(`  ${chalk.gray('CPU:')}         ${project.config.cpuLimit}`);
      console.log(`  ${chalk.gray('Auto Backup:')} ${project.config.autoBackup ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Start project
program
  .command('start <project>')
  .description('Start a project')
  .action(async (projectIdOrSlug) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      const spinner = ora(`Starting project "${project.name}"...`).start();
      await projectManager.startProject(project.id);
      spinner.succeed(`Project "${project.name}" started`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Stop project
program
  .command('stop <project>')
  .description('Stop a project')
  .action(async (projectIdOrSlug) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      const spinner = ora(`Stopping project "${project.name}"...`).start();
      await projectManager.stopProject(project.id);
      spinner.succeed(`Project "${project.name}" stopped`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Restart project
program
  .command('restart <project>')
  .description('Restart a project')
  .action(async (projectIdOrSlug) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      const spinner = ora(`Restarting project "${project.name}"...`).start();
      await projectManager.restartProject(project.id);
      spinner.succeed(`Project "${project.name}" restarted`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Delete project
program
  .command('delete <project>')
  .description('Delete a project')
  .option('--keep-data', 'Keep project data after deletion')
  .option('-f, --force', 'Skip confirmation')
  .action(async (projectIdOrSlug, options) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete "${project.name}"?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Deletion cancelled'));
          return;
        }
      }

      const spinner = ora(`Deleting project "${project.name}"...`).start();
      await projectManager.deleteProject(project.id, options.keepData);
      spinner.succeed(`Project "${project.name}" deleted`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Get logs
program
  .command('logs <project>')
  .description('Get project logs')
  .option('-t, --tail <lines>', 'Number of lines to show', '100')
  .action(async (projectIdOrSlug, options) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      const logs = await projectManager.getProjectLogs(project.id, parseInt(options.tail));
      console.log(logs);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Backup commands
const backup = program.command('backup').description('Backup management');

backup
  .command('create <project>')
  .description('Create a backup')
  .action(async (projectIdOrSlug) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      const spinner = ora(`Creating backup for "${project.name}"...`).start();
      const backupInfo = await projectManager.createBackup(project.id);
      spinner.succeed(`Backup created: ${backupInfo.filename}`);
      console.log(`  ${chalk.gray('Size:')} ${formatBytes(backupInfo.size)}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

backup
  .command('list <project>')
  .description('List backups')
  .action(async (projectIdOrSlug) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      const backups = await projectManager.listBackups(project.id);

      if (backups.length === 0) {
        console.log(chalk.yellow('No backups found'));
        return;
      }

      console.log('');
      console.log(chalk.bold(`Backups for ${project.name}:`));
      console.log('');

      for (const backup of backups) {
        console.log(`  ${chalk.bold(backup.filename)}`);
        console.log(
          `    ${chalk.gray('Created:')} ${backup.createdAt.toISOString()}  ${chalk.gray('Size:')} ${formatBytes(backup.size)}`
        );
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

backup
  .command('restore <project> <filename>')
  .description('Restore from backup')
  .option('-f, --force', 'Skip confirmation')
  .action(async (projectIdOrSlug, filename, options) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `This will overwrite current data. Continue?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Restore cancelled'));
          return;
        }
      }

      const spinner = ora(`Restoring "${project.name}" from ${filename}...`).start();
      await projectManager.restoreBackup(project.id, filename);
      spinner.succeed(`Project "${project.name}" restored from backup`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show overall statistics')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      await projectManager.initialize();
      const stats = await projectManager.getStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.bold('PocketBase Manager Statistics'));
      console.log('');
      console.log(`  ${chalk.gray('Total Projects:')}   ${stats.totalProjects}`);
      console.log(`  ${chalk.gray('Running:')}          ${chalk.green(stats.runningProjects)}`);
      console.log(`  ${chalk.gray('Stopped:')}          ${chalk.yellow(stats.stoppedProjects)}`);
      console.log(`  ${chalk.gray('Total Storage:')}    ${stats.totalStorage}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// URL command (quick access)
program
  .command('url <project>')
  .description('Get project URLs')
  .option('--admin', 'Show admin URL only')
  .option('--api', 'Show API URL only')
  .action(async (projectIdOrSlug, options) => {
    try {
      await projectManager.initialize();

      let project = await projectManager.getProject(projectIdOrSlug);
      if (!project) {
        project = await projectManager.getProjectBySlug(projectIdOrSlug);
      }

      if (!project) {
        console.error(chalk.red(`Project not found: ${projectIdOrSlug}`));
        process.exit(1);
      }

      const url = await projectManager.getProjectUrl(project.id);
      const adminUrl = await projectManager.getProjectAdminUrl(project.id);

      if (options.admin) {
        console.log(adminUrl);
      } else if (options.api) {
        console.log(url);
      } else {
        console.log(`API:   ${url}`);
        console.log(`Admin: ${adminUrl}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Create user command
program
  .command('create-user <email> <password>')
  .description('Create a PocketBase admin user for a project or container')
  .option('-p, --project <project>', 'Project ID or slug')
  .option('-d, --domain <domain>', 'Find project by domain')
  .option('-c, --container <container>', 'Use container name directly (skip project lookup)')
  .action(async (email, password, options) => {
    try {
      await projectManager.initialize();

      // If container name is provided directly, use it
      if (options.container) {
        const spinner = ora(`Creating user ${email} for container "${options.container}"...`).start();
        
        try {
          await projectManager.createUserForContainer(options.container, email, password);
          spinner.succeed(`User ${email} created successfully for container "${options.container}"`);
          console.log('');
          console.log(chalk.bold('User Details:'));
          console.log(`  ${chalk.gray('Email:')}     ${email}`);
          console.log(`  ${chalk.gray('Container:')} ${options.container}`);
          console.log('');
          console.log(chalk.yellow('You can now login to the admin panel with these credentials.'));
        } catch (error) {
          spinner.fail(`Failed to create user`);
          throw error;
        }
        return;
      }

      // Find project by domain, project ID/slug, or infer from domain pattern
      let project;
      
      if (options.domain) {
        project = await projectManager.getProjectByDomain(options.domain);
        if (!project) {
          // Try to infer container name from domain
          const domainParts = options.domain.split('.');
          if (domainParts.length >= 3) {
            const slug = domainParts[0]; // e.g., "api" from "api.db.oceannet.dev"
            const inferredContainer = `pocketbase-${slug}`;
            console.log(chalk.yellow(`Project not found in metadata, trying container: ${inferredContainer}`));
            
            const spinner = ora(`Creating user ${email} for container "${inferredContainer}"...`).start();
            try {
              await projectManager.createUserForContainer(inferredContainer, email, password);
              spinner.succeed(`User ${email} created successfully`);
              console.log('');
              console.log(chalk.bold('User Details:'));
              console.log(`  ${chalk.gray('Email:')}     ${email}`);
              console.log(`  ${chalk.gray('Domain:')}    ${options.domain}`);
              console.log(`  ${chalk.gray('Container:')} ${inferredContainer}`);
              console.log(`  ${chalk.gray('Admin URL:')} ${chalk.cyan(`https://${options.domain}/_/`)}`);
              console.log('');
              console.log(chalk.yellow('You can now login to the admin panel with these credentials.'));
              return;
            } catch (error) {
              spinner.fail(`Container "${inferredContainer}" not found or not accessible`);
              throw new Error(`Could not find project or container for domain: ${options.domain}`);
            }
          }
        }
      } else if (options.project) {
        project = await projectManager.getProject(options.project);
        if (!project) {
          project = await projectManager.getProjectBySlug(options.project);
        }
      }

      if (!project) {
        console.error(chalk.red(`Project not found. Please specify:`));
        console.error(chalk.gray('  --project <id-or-slug>'));
        console.error(chalk.gray('  --domain <domain>'));
        console.error(chalk.gray('  --container <container-name>'));
        process.exit(1);
      }

      if (project.status !== 'running') {
        console.error(chalk.red(`Project "${project.name}" is not running. Please start it first.`));
        process.exit(1);
      }

      const spinner = ora(`Creating user ${email} for "${project.name}"...`).start();
      
      try {
        await projectManager.createUser(project.id, email, password);
        spinner.succeed(`User ${email} created successfully for "${project.name}"`);
        
        const adminUrl = await projectManager.getProjectAdminUrl(project.id);
        console.log('');
        console.log(chalk.bold('User Details:'));
        console.log(`  ${chalk.gray('Email:')}    ${email}`);
        console.log(`  ${chalk.gray('Project:')}  ${project.name} (${project.slug})`);
        console.log(`  ${chalk.gray('Admin URL:')} ${chalk.cyan(adminUrl)}`);
        console.log('');
        console.log(chalk.yellow('You can now login to the admin panel with these credentials.'));
      } catch (error) {
        spinner.fail(`Failed to create user`);
        throw error;
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

program.parse();

