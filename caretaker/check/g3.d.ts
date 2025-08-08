import { G3StatsData } from '../../utils/g3.js';
import { BaseModule } from './base.js';
export declare class G3Module extends BaseModule<G3StatsData | void> {
    retrieveData(): Promise<G3StatsData | undefined>;
    printToTerminal(): Promise<void>;
}
