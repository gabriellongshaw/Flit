import { profile } from '../core/profile.js';
import { resolveLook } from '../core/cosmetics.js';

export const currentLook = () => resolveLook(profile.state.equipped);
