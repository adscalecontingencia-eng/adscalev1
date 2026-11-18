import * as client from './client';
import * as agency from './agency';
import * as adminCore from './admin_core';
import * as adminFinance from './admin_finance';
import * as adminMeta from './admin_meta';
import * as adminSupport from './admin_support';

const areas = [client, agency, adminCore, adminFinance, adminMeta, adminSupport];

export const areaPt = Object.assign({}, ...areas.map(a => a.pt));
export const areaEn = Object.assign({}, ...areas.map(a => a.en));
export const areaEs = Object.assign({}, ...areas.map(a => a.es));
