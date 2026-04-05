import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ScenarioInput {
    d7_microSupply: bigint;
    d8_microDemand: bigint;
    d15_tradeStability: bigint;
    d14_positionRisk: bigint;
    d4_microFlow: bigint;
    d9_sectorStrength: bigint;
    d12_assetWeakness: bigint;
    d2_macroFlow: bigint;
    d10_sectorWeakness: bigint;
    d5_macroSupply: bigint;
    d1_macroAccumulation: bigint;
    d6_macroDemand: bigint;
    d13_positionControl: bigint;
    d11_assetStrength: bigint;
    d16_stateStability: bigint;
    d3_microAccumulation: bigint;
    symbol: string;
}
export interface Scenario {
    created: bigint;
    d7_microSupply: bigint;
    d8_microDemand: bigint;
    d15_tradeStability: bigint;
    d14_positionRisk: bigint;
    d4_microFlow: bigint;
    d9_sectorStrength: bigint;
    d12_assetWeakness: bigint;
    d2_macroFlow: bigint;
    d10_sectorWeakness: bigint;
    d5_macroSupply: bigint;
    d1_macroAccumulation: bigint;
    d6_macroDemand: bigint;
    d13_positionControl: bigint;
    updated: bigint;
    d11_assetStrength: bigint;
    d16_stateStability: bigint;
    d3_microAccumulation: bigint;
    symbol: string;
}
export interface backendInterface {
    createScenario(input: ScenarioInput): Promise<bigint>;
    deleteScenario(id: bigint): Promise<void>;
    getScenario(id: bigint): Promise<Scenario>;
    listAllScenarios(): Promise<Array<Scenario>>;
    updateScenario(id: bigint, input: ScenarioInput): Promise<void>;
}
