/** Blood glucose unit conversion. CareLink stores mg/dL internally. */
const MGDL_TO_MMOL = 1 / 18.0182;

export function toMmol(mgdl) {
    if (mgdl == null || isNaN(mgdl)) return null;
    return Math.round(mgdl * MGDL_TO_MMOL * 10) / 10;
}

export function toMgdl(mmol) {
    if (mmol == null || isNaN(mmol)) return null;
    return Math.round(mmol / MGDL_TO_MMOL);
}
