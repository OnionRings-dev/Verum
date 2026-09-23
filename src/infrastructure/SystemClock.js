// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/** Infrastruttura · adattatore della porta Clock. */
import { Clock } from '../application/ports.js';
export class SystemClock extends Clock { now() { return new Date(); } }
