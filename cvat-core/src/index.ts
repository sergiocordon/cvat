// Copyright (C) 2023 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import PluginRegistry from './plugins';
import serverProxy from './server-proxy';
import lambdaManager from './lambda-manager';
import { AnnotationFormats } from './annotation-formats';
import loggerStorage from './logger-storage';
import * as enums from './enums';
import config from './config';
import { mask2Rle, rle2Mask } from './object-utils';
import User from './user';
import Project from './project';
import { Job, Task } from './session';
import { EventLogger } from './log';
import { Attribute, Label } from './labels';
import Statistics from './statistics';
import ObjectState from './object-state';
import MLModel from './ml-model';
import Issue from './issue';
import Comment from './comment';
import { FrameData } from './frames';
import CloudStorage from './cloud-storage';
import Organization from './organization';
import Webhook from './webhook';
import AnnotationGuide from './guide';
import BaseSingleFrameAction, { listActions, registerAction, runActions } from './annotations-actions';
import {
    ArgumentError, DataError, Exception, ScriptingError, ServerError,
} from './exceptions';

export default interface CVATCore {
    plugins: {
        list: typeof PluginRegistry.list;
        register: typeof PluginRegistry.register;
    };
    lambda: {
        list: typeof lambdaManager.list;
        run: typeof lambdaManager.run;
        call: typeof lambdaManager.call;
        cancel: typeof lambdaManager.cancel;
        listen: typeof lambdaManager.listen;
        requests: typeof lambdaManager.requests;
    };
    server: {
        about: typeof serverProxy.server.about;
        share: (dir: string) => Promise<{
            mimeType: string;
            name: string;
            type: enums.ShareFileType;
        }[]>;
        formats: () => Promise<AnnotationFormats>;
        userAgreements: typeof serverProxy.server.userAgreements,
        register: any; // TODO: add types later
        login: any;
        logout: any;
        changePassword: any;
        requestPasswordReset: any;
        resetPassword: any;
        authorized: any;
        healthCheck: any;
        request: any;
        setAuthData: any;
        removeAuthData: any;
        installedApps: any;
    };
    assets: {
        create: any;
    };
    users: {
        get: any;
    };
    jobs: {
        get: any;
    };
    tasks: {
        get: any;
    }
    projects: {
        get: any;
        searchNames: any;
    };
    cloudStorages: {
        get: any;
    };
    organizations: {
        get: any;
        activate: any;
        deactivate: any;
        acceptInvitation: any;
    };
    webhooks: {
        get: any;
    };
    analytics: {
        quality: {
            reports: any;
            conflicts: any;
            settings: any;
        };
        performance: {
            reports: any;
        };
    };
    frames: {
        getMeta: any;
    };
    actions: {
        list: typeof listActions;
        register: typeof registerAction;
        run: typeof runActions;
    };
    logger: typeof loggerStorage;
    config: {
        backendAPI: typeof config.backendAPI;
        origin: typeof config.origin;
        uploadChunkSize: typeof config.uploadChunkSize;
        removeUnderlyingMaskPixels: typeof config.removeUnderlyingMaskPixels;
        onOrganizationChange: typeof config.onOrganizationChange;
    },
    client: {
        version: string;
    };
    enums,
    exceptions: {
        Exception: typeof Exception,
        ArgumentError: typeof ArgumentError,
        DataError: typeof DataError,
        ScriptingError: typeof ScriptingError,
        ServerError: typeof ServerError,
    },
    classes: {
        User: typeof User;
        Project: typeof Project;
        Task: typeof Task;
        Job: typeof Job;
        EventLogger: typeof EventLogger;
        Attribute: typeof Attribute;
        Label: typeof Label;
        Statistics: typeof Statistics;
        ObjectState: typeof ObjectState;
        MLModel: typeof MLModel;
        Comment: typeof Comment;
        Issue: typeof Issue;
        FrameData: typeof FrameData;
        CloudStorage: typeof CloudStorage;
        Organization: typeof Organization;
        Webhook: typeof Webhook;
        AnnotationGuide: typeof AnnotationGuide;
        BaseSingleFrameAction: typeof BaseSingleFrameAction;
    };
    utils: {
        mask2Rle: typeof mask2Rle;
        rle2Mask: typeof rle2Mask;
    };
}
