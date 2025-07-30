"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceRarity = exports.ResourceCategory = exports.HarvestingCategory = void 0;
var HarvestingCategory;
(function (HarvestingCategory) {
    HarvestingCategory["LITERARY"] = "literary";
    HarvestingCategory["MECHANICAL"] = "mechanical";
    HarvestingCategory["ALCHEMICAL"] = "alchemical";
    HarvestingCategory["ARCHAEOLOGICAL"] = "archaeological";
    HarvestingCategory["BOTANICAL"] = "botanical";
    HarvestingCategory["METALLURGICAL"] = "metallurgical";
    HarvestingCategory["ELECTRICAL"] = "electrical";
    HarvestingCategory["AERONAUTICAL"] = "aeronautical";
})(HarvestingCategory = exports.HarvestingCategory || (exports.HarvestingCategory = {}));
var ResourceCategory;
(function (ResourceCategory) {
    ResourceCategory["LITERARY_MATERIALS"] = "literary_materials";
    ResourceCategory["MECHANICAL_PARTS"] = "mechanical_parts";
    ResourceCategory["ALCHEMICAL_REAGENTS"] = "alchemical_reagents";
    ResourceCategory["ARCHAEOLOGICAL_ARTIFACTS"] = "archaeological_artifacts";
    ResourceCategory["BOTANICAL_SPECIMENS"] = "botanical_specimens";
    ResourceCategory["METAL_INGOTS"] = "metal_ingots";
    ResourceCategory["ELECTRICAL_COMPONENTS"] = "electrical_components";
    ResourceCategory["AERONAUTICAL_PARTS"] = "aeronautical_parts";
    ResourceCategory["RARE_TREASURES"] = "rare_treasures";
})(ResourceCategory = exports.ResourceCategory || (exports.ResourceCategory = {}));
var ResourceRarity;
(function (ResourceRarity) {
    ResourceRarity["COMMON"] = "common";
    ResourceRarity["UNCOMMON"] = "uncommon";
    ResourceRarity["RARE"] = "rare";
    ResourceRarity["LEGENDARY"] = "legendary";
})(ResourceRarity = exports.ResourceRarity || (exports.ResourceRarity = {}));
