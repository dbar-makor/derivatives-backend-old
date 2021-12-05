import express from 'express';

import ServerGlobal from '../server-global';

interface IBodyField {
    readonly key: string;
    readonly type: string;
}

/**
* Build a middleware to set required body fields
* @param fields List of keys mandatory to use the API
*/
const bodyKeys = (fields: IBodyField[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const keys = Object.keys(req.body);
        const invalidFields: IBodyField[] = [];

        for (const field of fields) {
            const key = keys.find((key: string) => field.key === key);

            // Validate existance and type
            if (!key || field.type !== typeof req.body[key]) {
                invalidFields.push(field);
                continue;
            }
        }

        if (!!invalidFields.length) {
            const fieldsList = invalidFields.map((field: IBodyField) => `${field.key} (${field.type})`);

            ServerGlobal.getInstance().logger.error(
                `Got a request for ${req.url} but missed the body keys: ${fieldsList.join(', ')}`
            );

            return res.status(406).json({
                success: false,
                message: `Please provide ${fieldsList.join(', ')}.`,
            });
        }

        next();
    };
};

export { bodyKeys };