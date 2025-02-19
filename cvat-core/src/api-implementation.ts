// Copyright (C) 2019-2022 Intel Corporation
// Copyright (C) 2022-2023 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { omit } from 'lodash';
import config from './config';

import PluginRegistry from './plugins';
import serverProxy from './server-proxy';
import lambdaManager from './lambda-manager';
import {
    isBoolean,
    isInteger,
    isString,
    checkFilter,
    checkExclusiveFields,
    checkObjectType,
    filterFieldsToSnakeCase,
} from './common';

import User from './user';
import { AnnotationFormats } from './annotation-formats';
import { Task, Job } from './session';
import Project from './project';
import CloudStorage from './cloud-storage';
import Organization from './organization';
import Webhook from './webhook';
import { ArgumentError } from './exceptions';
import { SerializedAsset } from './server-response-types';
import QualityReport from './quality-report';
import QualityConflict from './quality-conflict';
import QualitySettings from './quality-settings';
import { FramesMetaData } from './frames';
import AnalyticsReport from './analytics-report';
import { listActions, registerAction, runActions } from './annotations-actions';
import CVATCore from '.';

function implementationMixin(func: Function, implementation: Function): void {
    Object.assign(func, { implementation });
}

export default function implementAPI(cvat: CVATCore): CVATCore {
    implementationMixin(cvat.plugins.list, PluginRegistry.list);
    implementationMixin(cvat.plugins.register, PluginRegistry.register.bind(cvat));
    implementationMixin(cvat.actions.list, listActions);
    implementationMixin(cvat.actions.register, registerAction);
    implementationMixin(cvat.actions.run, runActions);

    implementationMixin(cvat.lambda.list, lambdaManager.list.bind(lambdaManager));
    implementationMixin(cvat.lambda.run, lambdaManager.run.bind(lambdaManager));
    implementationMixin(cvat.lambda.call, lambdaManager.call.bind(lambdaManager));
    implementationMixin(cvat.lambda.cancel, lambdaManager.cancel.bind(lambdaManager));
    implementationMixin(cvat.lambda.listen, lambdaManager.listen.bind(lambdaManager));
    implementationMixin(cvat.lambda.requests, lambdaManager.requests.bind(lambdaManager));

    implementationMixin(cvat.server.about, async () => {
        const result = await serverProxy.server.about();
        return result;
    });
    implementationMixin(cvat.server.share, async (directory: string, searchPrefix?: string) => {
        const result = await serverProxy.server.share(directory, searchPrefix);
        return result.map((item) => ({ ...omit(item, 'mime_type'), mimeType: item.mime_type }));
    });
    implementationMixin(cvat.server.formats, async () => {
        const result = await serverProxy.server.formats();
        return new AnnotationFormats(result);
    });
    implementationMixin(cvat.server.userAgreements, async () => {
        const result = await serverProxy.server.userAgreements();
        return result;
    });
    implementationMixin(cvat.server.register, async (
        username,
        firstName,
        lastName,
        email,
        password,
        userConfirmations,
    ) => {
        const user = await serverProxy.server.register(
            username,
            firstName,
            lastName,
            email,
            password,
            userConfirmations,
        );

        return new User(user);
    });
    implementationMixin(cvat.server.login, async (username, password) => {
        await serverProxy.server.login(username, password);
    });
    implementationMixin(cvat.server.logout, async () => {
        await serverProxy.server.logout();
    });
    implementationMixin(cvat.server.changePassword, async (oldPassword, newPassword1, newPassword2) => {
        await serverProxy.server.changePassword(oldPassword, newPassword1, newPassword2);
    });
    implementationMixin(cvat.server.requestPasswordReset, async (email) => {
        await serverProxy.server.requestPasswordReset(email);
    });
    implementationMixin(cvat.server.resetPassword, async (newPassword1, newPassword2, uid, token) => {
        await serverProxy.server.resetPassword(newPassword1, newPassword2, uid, token);
    });
    implementationMixin(cvat.server.authorized, async () => {
        const result = await serverProxy.server.authorized();
        return result;
    });
    implementationMixin(cvat.server.healthCheck, async (
        maxRetries = 1,
        checkPeriod = 3000,
        requestTimeout = 5000,
        progressCallback = undefined,
    ) => {
        const result = await serverProxy.server.healthCheck(maxRetries, checkPeriod, requestTimeout, progressCallback);
        return result;
    });
    implementationMixin(cvat.server.request, async (url, data, requestConfig) => {
        const result = await serverProxy.server.request(url, data, requestConfig);
        return result;
    });
    implementationMixin(cvat.server.setAuthData, async (response) => {
        const result = await serverProxy.server.setAuthData(response);
        return result;
    });
    implementationMixin(cvat.server.removeAuthData, async () => {
        const result = await serverProxy.server.removeAuthData();
        return result;
    });
    implementationMixin(cvat.server.installedApps, async () => {
        const result = await serverProxy.server.installedApps();
        return result;
    });

    implementationMixin(cvat.assets.create, async (file: File, guideId: number): Promise<SerializedAsset> => {
        if (!(file instanceof File)) {
            throw new ArgumentError('Assets expect a file');
        }

        const result = await serverProxy.assets.create(file, guideId);
        return result;
    });

    implementationMixin(cvat.users.get, async (filter) => {
        checkFilter(filter, {
            id: isInteger,
            is_active: isBoolean,
            self: isBoolean,
            search: isString,
            limit: isInteger,
        });

        let users = null;
        if ('self' in filter && filter.self) {
            users = await serverProxy.users.self();
            users = [users];
        } else {
            const searchParams = {};
            for (const key in filter) {
                if (filter[key] && key !== 'self') {
                    searchParams[key] = filter[key];
                }
            }
            users = await serverProxy.users.get(searchParams);
        }

        users = users.map((user) => new User(user));
        return users;
    });

    implementationMixin(cvat.jobs.get, async (query) => {
        checkFilter(query, {
            page: isInteger,
            filter: isString,
            sort: isString,
            search: isString,
            jobID: isInteger,
            taskID: isInteger,
            type: isString,
        });

        checkExclusiveFields(query, ['jobID', 'filter', 'search'], ['page', 'sort']);
        if ('jobID' in query) {
            const { results } = await serverProxy.jobs.get({ id: query.jobID });
            const [job] = results;
            if (job) {
                // When request job by ID we also need to add labels to work with them
                const labels = await serverProxy.labels.get({ job_id: job.id });
                return [new Job({ ...job, labels: labels.results })];
            }

            return [];
        }

        const searchParams: Record<string, string> = {};

        for (const key of Object.keys(query)) {
            if (['page', 'sort', 'search', 'filter', 'type'].includes(key)) {
                searchParams[key] = query[key];
            }
        }
        if ('taskID' in query) {
            searchParams.task_id = query.taskID;
        }

        const jobsData = await serverProxy.jobs.get(searchParams);
        const jobs = jobsData.results.map((jobData) => new Job(jobData));
        jobs.count = jobsData.count;
        return jobs;
    });

    implementationMixin(cvat.tasks.get, async (filter) => {
        checkFilter(filter, {
            page: isInteger,
            projectId: isInteger,
            id: isInteger,
            sort: isString,
            search: isString,
            filter: isString,
            ordering: isString,
        });

        checkExclusiveFields(filter, ['id'], ['page']);
        const searchParams = {};
        for (const key of Object.keys(filter)) {
            if (['page', 'id', 'sort', 'search', 'filter', 'ordering'].includes(key)) {
                searchParams[key] = filter[key];
            }
        }

        if ('projectId' in filter) {
            if (searchParams.filter) {
                const parsed = JSON.parse(searchParams.filter);
                searchParams.filter = JSON.stringify({ and: [parsed, { '==': [{ var: 'project_id' }, filter.projectId] }] });
            } else {
                searchParams.filter = JSON.stringify({ and: [{ '==': [{ var: 'project_id' }, filter.projectId] }] });
            }
        }

        const tasksData = await serverProxy.tasks.get(searchParams);
        const tasks = await Promise.all(tasksData.map(async (taskItem) => {
            if ('id' in filter) {
                // When request task by ID we also need to add labels and jobs to work with them
                const labels = await serverProxy.labels.get({ task_id: taskItem.id });
                const jobs = await serverProxy.jobs.get({ task_id: taskItem.id }, true);
                return new Task({
                    ...taskItem, progress: taskItem.jobs, jobs: jobs.results, labels: labels.results,
                });
            }

            return new Task({
                ...taskItem,
                progress: taskItem.jobs,
            });
        }));

        tasks.count = tasksData.count;
        return tasks;
    });

    implementationMixin(cvat.projects.get, async (filter) => {
        checkFilter(filter, {
            id: isInteger,
            page: isInteger,
            search: isString,
            sort: isString,
            filter: isString,
        });

        checkExclusiveFields(filter, ['id'], ['page']);
        const searchParams = {};
        for (const key of Object.keys(filter)) {
            if (['page', 'id', 'sort', 'search', 'filter'].includes(key)) {
                searchParams[key] = filter[key];
            }
        }

        const projectsData = await serverProxy.projects.get(searchParams);
        const projects = await Promise.all(projectsData.map(async (projectItem) => {
            if ('id' in filter) {
                // When request a project by ID we also need to add labels to work with them
                const labels = await serverProxy.labels.get({ project_id: projectItem.id });
                return new Project({ ...projectItem, labels: labels.results });
            }

            return new Project({
                ...projectItem,
            });
        }));

        projects.count = projectsData.count;
        return projects;
    });

    implementationMixin(cvat.projects.searchNames,
        async (search, limit) => serverProxy.projects.searchNames(search, limit));

    implementationMixin(cvat.cloudStorages.get, async (filter) => {
        checkFilter(filter, {
            page: isInteger,
            filter: isString,
            sort: isString,
            id: isInteger,
            search: isString,
        });

        checkExclusiveFields(filter, ['id', 'search'], ['page']);
        const searchParams = {};
        for (const key of Object.keys(filter)) {
            if (['page', 'filter', 'sort', 'id', 'search'].includes(key)) {
                searchParams[key] = filter[key];
            }
        }
        const cloudStoragesData = await serverProxy.cloudStorages.get(searchParams);
        const cloudStorages = cloudStoragesData.map((cloudStorage) => new CloudStorage(cloudStorage));
        cloudStorages.count = cloudStoragesData.count;
        return cloudStorages;
    });

    implementationMixin(cvat.organizations.get, async (filter) => {
        checkFilter(filter, {
            search: isString,
            filter: isString,
        });

        const organizationsData = await serverProxy.organizations.get(filter);
        const organizations = organizationsData.map((organizationData) => new Organization(organizationData));
        return organizations;
    });
    implementationMixin(cvat.organizations.activate, (organization) => {
        checkObjectType('organization', organization, null, Organization);
        config.organization = {
            organizationID: organization.id,
            organizationSlug: organization.slug,
        };
    });
    implementationMixin(cvat.organizations.deactivate, async () => {
        config.organization = {
            organizationID: null,
            organizationSlug: null,
        };
    });
    implementationMixin(cvat.organizations.acceptInvitation, async (
        username,
        firstName,
        lastName,
        email,
        password,
        userConfirmations,
        key,
    ) => {
        const orgSlug = await serverProxy.organizations.acceptInvitation(
            username,
            firstName,
            lastName,
            email,
            password,
            userConfirmations,
            key,
        );

        return orgSlug;
    });

    implementationMixin(cvat.webhooks.get, async (filter) => {
        checkFilter(filter, {
            page: isInteger,
            id: isInteger,
            projectId: isInteger,
            filter: isString,
            search: isString,
            sort: isString,
        });

        checkExclusiveFields(filter, ['id', 'projectId'], ['page']);

        const searchParams = filterFieldsToSnakeCase(filter, ['projectId']);

        const webhooksData = await serverProxy.webhooks.get(searchParams);
        const webhooks = webhooksData.map((webhookData) => new Webhook(webhookData));
        webhooks.count = webhooksData.count;
        return webhooks;
    });

    implementationMixin(cvat.analytics.quality.reports, async (filter) => {
        let updatedParams: Record<string, string> = {};
        if ('taskId' in filter) {
            updatedParams = {
                task_id: filter.taskId,
                sort: '-created_date',
                target: filter.target,
            };
        }
        if ('jobId' in filter) {
            updatedParams = {
                job_id: filter.jobId,
                sort: '-created_date',
                target: filter.target,
            };
        }
        const reportsData = await serverProxy.analytics.quality.reports(updatedParams);

        return reportsData.map((report) => new QualityReport({ ...report }));
    });
    implementationMixin(cvat.analytics.quality.conflicts, async (filter) => {
        let updatedParams: Record<string, string> = {};
        if ('reportId' in filter) {
            updatedParams = {
                report_id: filter.reportId,
            };
        }

        const reportsData = await serverProxy.analytics.quality.conflicts(updatedParams);

        return reportsData.map((conflict) => new QualityConflict({ ...conflict }));
    });
    implementationMixin(cvat.analytics.quality.settings.get, async (taskID: number) => {
        const settings = await serverProxy.analytics.quality.settings.get(taskID);
        return new QualitySettings({ ...settings });
    });
    implementationMixin(cvat.analytics.performance.reports, async (filter) => {
        checkFilter(filter, {
            jobID: isInteger,
            taskID: isInteger,
            projectID: isInteger,
            startDate: isString,
            endDate: isString,
        });

        checkExclusiveFields(filter, ['jobID', 'taskID', 'projectID'], ['startDate', 'endDate']);

        const updatedParams: Record<string, string> = {};

        if ('taskID' in filter) {
            updatedParams.task_id = filter.taskID;
        }
        if ('jobID' in filter) {
            updatedParams.job_id = filter.jobID;
        }
        if ('projectID' in filter) {
            updatedParams.project_id = filter.projectID;
        }
        if ('startDate' in filter) {
            updatedParams.start_date = filter.startDate;
        }
        if ('endDate' in filter) {
            updatedParams.end_date = filter.endDate;
        }

        const reportData = await serverProxy.analytics.performance.reports(updatedParams);
        return new AnalyticsReport(reportData);
    });
    implementationMixin(cvat.frames.getMeta, async (type, id) => {
        const result = await serverProxy.frames.getMeta(type, id);
        return new FramesMetaData({ ...result });
    });

    return cvat;
}
