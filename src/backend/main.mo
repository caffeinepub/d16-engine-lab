import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";

actor {
  type Scenario = {
    symbol : Text;
    d1_macroAccumulation : Nat;
    d2_macroFlow : Nat;
    d3_microAccumulation : Nat;
    d4_microFlow : Nat;
    d5_macroSupply : Nat;
    d6_macroDemand : Nat;
    d7_microSupply : Nat;
    d8_microDemand : Nat;
    d9_sectorStrength : Nat;
    d10_sectorWeakness : Nat;
    d11_assetStrength : Nat;
    d12_assetWeakness : Nat;
    d13_positionControl : Nat;
    d14_positionRisk : Nat;
    d15_tradeStability : Nat;
    d16_stateStability : Nat;
    created : Int;
    updated : Int;
  };

  module Scenario {
    public func compare(a : Scenario, b : Scenario) : Order.Order {
      Nat.compare(a.d1_macroAccumulation, b.d1_macroAccumulation);
    }
  };

  let scenarios = Map.empty<Nat, Scenario>();
  var nextId = 0;

  public type ScenarioInput =  {
    symbol : Text;
    d1_macroAccumulation : Nat;
    d2_macroFlow : Nat;
    d3_microAccumulation : Nat;
    d4_microFlow : Nat;
    d5_macroSupply : Nat;
    d6_macroDemand : Nat;
    d7_microSupply : Nat;
    d8_microDemand : Nat;
    d9_sectorStrength : Nat;
    d10_sectorWeakness : Nat;
    d11_assetStrength : Nat;
    d12_assetWeakness : Nat;
    d13_positionControl : Nat;
    d14_positionRisk : Nat;
    d15_tradeStability : Nat;
    d16_stateStability : Nat;
  };

  public shared ({ caller }) func createScenario(input : ScenarioInput) : async Nat {
    let id = nextId;
    let timestamp = Time.now();

    let newScenario : Scenario = {
      symbol = input.symbol;
      d1_macroAccumulation = input.d1_macroAccumulation;
      d2_macroFlow = input.d2_macroFlow;
      d3_microAccumulation = input.d3_microAccumulation;
      d4_microFlow = input.d4_microFlow;
      d5_macroSupply = input.d5_macroSupply;
      d6_macroDemand = input.d6_macroDemand;
      d7_microSupply = input.d7_microSupply;
      d8_microDemand = input.d8_microDemand;
      d9_sectorStrength = input.d9_sectorStrength;
      d10_sectorWeakness = input.d10_sectorWeakness;
      d11_assetStrength = input.d11_assetStrength;
      d12_assetWeakness = input.d12_assetWeakness;
      d13_positionControl = input.d13_positionControl;
      d14_positionRisk = input.d14_positionRisk;
      d15_tradeStability = input.d15_tradeStability;
      d16_stateStability = input.d16_stateStability;
      created = timestamp;
      updated = timestamp;
    };

    scenarios.add(id, newScenario);
    nextId += 1;
    id;
  };

  public query ({ caller }) func getScenario(id : Nat) : async Scenario {
    switch (scenarios.get(id)) {
      case (null) { Runtime.trap("Scenario not found") };
      case (?scenario) { scenario };
    };
  };

  public query ({ caller }) func listAllScenarios() : async [Scenario] {
    scenarios.values().toArray();
  };

  public shared ({ caller }) func updateScenario(id : Nat, input : ScenarioInput) : async () {
    let existingScenario = switch (scenarios.get(id)) {
      case (null) { Runtime.trap("Scenario not found") };
      case (?scenario) { scenario };
    };

    let updatedScenario : Scenario = {
      symbol = input.symbol;
      d1_macroAccumulation = input.d1_macroAccumulation;
      d2_macroFlow = input.d2_macroFlow;
      d3_microAccumulation = input.d3_microAccumulation;
      d4_microFlow = input.d4_microFlow;
      d5_macroSupply = input.d5_macroSupply;
      d6_macroDemand = input.d6_macroDemand;
      d7_microSupply = input.d7_microSupply;
      d8_microDemand = input.d8_microDemand;
      d9_sectorStrength = input.d9_sectorStrength;
      d10_sectorWeakness = input.d10_sectorWeakness;
      d11_assetStrength = input.d11_assetStrength;
      d12_assetWeakness = input.d12_assetWeakness;
      d13_positionControl = input.d13_positionControl;
      d14_positionRisk = input.d14_positionRisk;
      d15_tradeStability = input.d15_tradeStability;
      d16_stateStability = input.d16_stateStability;
      created = existingScenario.created;
      updated = Time.now();
    };

    scenarios.add(id, updatedScenario);
  };

  public shared ({ caller }) func deleteScenario(id : Nat) : async () {
    if (not scenarios.containsKey(id)) {
      Runtime.trap("Scenario not found. ");
    };
    scenarios.remove(id);
  };
};
