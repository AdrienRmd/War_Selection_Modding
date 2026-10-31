/** Conteneurs de jeux de données des courbes de timeline — port fidèle de
 *  datasetStructure.js (IbubussI / wsunitstats-static).
 *
 *  Écart de structure vs la source (JS non typé) : TimeLineMultiRowDataset
 *  n'hérite pas de TimeLineDataset — leurs `values` ont des formes
 *  incompatibles (number[][] vs number[]) — mais de BaseDataset, qui porte
 *  le suivi min/max/sommes/moyennes (comportement identique à la source). */

export class DatasetContainer {
  containerName: string;
  containerType: string;
  containerDescription: string;
  valueType: string;
  datasetGroups: DatasetGroup[] = [];
  eventTypes?: readonly string[];
  eventFilterLabel?: string;

  constructor(
    locKeyPrefix: string,
    valueType = "num",
    containerType = "points",
    eventTypes: readonly string[] | null = null,
  ) {
    this.containerName = `${locKeyPrefix}Name`;
    this.containerType = containerType;
    this.containerDescription = `${locKeyPrefix}Description`;
    this.valueType = valueType;
    if (containerType === "events" && eventTypes) {
      this.eventTypes = eventTypes;
      this.eventFilterLabel = `${locKeyPrefix}FiltersLabel`;
    }
  }

  addDatasetGroup(datasetGroup: DatasetGroup): void {
    this.datasetGroups.push(datasetGroup);
  }
}

/** Conteneur multi-lignes (ex. 3 ressources dans un même jeu de données). */
export class MultiRowDatasetContainer extends DatasetContainer {
  rowNum: number;
  rowNames: readonly string[];
  isLocalizeRowNames: boolean;
  rowColors: readonly string[];
  rowIcons: readonly string[];

  constructor(
    locKeyPrefix: string,
    rowNum: number,
    rowNames: readonly string[],
    rowColors: readonly string[],
    rowIcons: readonly string[],
    isLocalizeRowNames = true,
    valueType = "num",
  ) {
    super(locKeyPrefix, valueType);
    this.containerType = "multiRow";
    this.rowNum = rowNum;
    this.rowNames = rowNames;
    this.rowColors = rowColors;
    this.rowIcons = rowIcons;
    this.isLocalizeRowNames = isLocalizeRowNames;
  }
}

export class DatasetGroup {
  dataGroupIdentifier: string;
  dataGroupName: string;
  defaultValues: Set<unknown>;
  datasets: BaseDataset[] = [];

  constructor(name: string, identifier: string, defaultValues: readonly unknown[] = []) {
    this.dataGroupName = name;
    this.dataGroupIdentifier = identifier;
    this.defaultValues = new Set(defaultValues);
  }

  addDataset(dataset: BaseDataset): void {
    this.datasets.push(dataset);
  }
}

export type TimeLineResult = "death" | "win" | "wonder" | "timeout";

export type KFunction = (value: number, time: number) => number;

export abstract class BaseDataset {
  values: unknown[] = [0]; // 0 = point initial de la timeline (non capturé)
  datasetName: string;
  isLocalizeName: boolean;
  localizationDynamicValue: number | null;
  result: TimeLineResult;
  color: string | null;

  // Suivi min/max/sommes/moyennes (porté par la base : partagé par tous les
  // types de jeux de données, comme dans la source via l'héritage).
  maxSize: number;
  pointsSum = 0;
  /** Moyenne locale — sur la durée de vie de l'entité (ex. survie joueur). */
  pointsAvgLocal = 0;
  /** Moyenne globale — sur la durée du match. */
  pointsAvgGlobal = 0;
  pointsSumK = 0;
  pointsAvgLocalK = 0;
  pointsAvgGlobalK = 0;
  min = Number.MAX_VALUE;
  max = Number.MIN_VALUE;
  kFunc?: KFunction;

  constructor(
    name: string,
    isLocalizeName: boolean,
    localizationDynamicValue: number | null,
    result: TimeLineResult,
    color: string | null,
    timeLineLength: number,
    kFunc?: KFunction,
  ) {
    this.datasetName = name;
    this.isLocalizeName = isLocalizeName;
    this.localizationDynamicValue = localizationDynamicValue;
    this.result = result;
    this.color = color;
    this.maxSize = timeLineLength;
    this.kFunc = kFunc;
  }

  protected calcTrackingFeatures(value: number, length: number, time?: number): void {
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);
    this.pointsSum = this.pointsSum + value;
    this.pointsAvgLocal = this.pointsSum / length;
    this.pointsAvgGlobal = this.pointsSum / this.maxSize;
    if (this.kFunc && time) {
      this.pointsSumK = this.pointsSumK + this.kFunc(value, time);
      this.pointsAvgLocalK = this.pointsSumK / length;
      this.pointsAvgGlobalK = this.pointsSumK / this.maxSize;
    }
  }
}

export class TimeLineDataset extends BaseDataset {
  declare values: number[];
  valuesComputed: number[] = [];

  constructor(
    name: string,
    isLocalizeName: boolean,
    localizationDynamicValue: number | null,
    result: TimeLineResult,
    color: string | null,
    timeLineLength: number,
    kFunc?: KFunction,
  ) {
    super(name, isLocalizeName, localizationDynamicValue, result, color, timeLineLength, kFunc);
    this.values = [0];
  }

  /** Ajoute une valeur en suivant min/max/moyennes/sommes. */
  push(value: number, time?: number): void {
    this.values.push(value);
    this.valuesComputed.push(1);
    this.calcTrackingFeatures(value, this.values.length, time);
  }

  /** Calcule une valeur à partir de la précédente (moyenne ou somme). */
  compute(
    index: number,
    computeFunc: (current: number, computed: number) => number,
    time?: number,
  ): void {
    index++; // la première valeur est toujours 0 : décale les autres de 1
    const arrVal = this.values[index];
    const arrComputedVal = this.valuesComputed[index];
    const currentValue = arrVal != null ? arrVal : 0;
    const computedValues = arrComputedVal != null ? arrComputedVal : 0;
    const value = computeFunc(currentValue, computedValues);
    this.values[index] = value;
    this.valuesComputed[index] = computedValues + 1;
    this.calcTrackingFeatures(value, this.values.length, time);
  }

  computeAvg(index: number, value: number, time?: number): void {
    this.compute(index, (curr, total) => (curr * total + value) / (total + 1), time);
  }

  computeSum(index: number, value: number, time?: number): void {
    this.compute(index, (curr) => curr + value, time);
  }
}

/** Jeu de données en tableau 2D (une valeur par ligne et par tranche). */
export class TimeLineMultiRowDataset extends BaseDataset {
  declare values: number[][];
  valuesComputed: number[][] = [];

  constructor(
    name: string,
    isLocalizeName: boolean,
    localizationDynamicValue: number | null,
    result: TimeLineResult,
    rowNum: number,
    timeLineLength: number,
  ) {
    super(name, isLocalizeName, localizationDynamicValue, result, null, timeLineLength);
    this.values = Array.from(Array(rowNum), () => []);
    this.valuesComputed = Array.from(Array(rowNum), () => []);
  }

  push(values: readonly number[]): void {
    this.checkIntegrity(values);
    values.forEach((value, row) => {
      this.values[row].push(value);
      this.valuesComputed[row].push(1);
      this.calcTrackingFeatures(value, this.values[row].length);
    });
  }

  compute(
    index: number,
    computeFunc: (current: number[], computed: number[]) => number[],
  ): void {
    index++;
    const currentValue = this.values.map((row) => (row[index] != null ? row[index] : 0));
    const computedValues = this.valuesComputed.map((row) => (row[index] != null ? row[index] : 0));
    const values = computeFunc(currentValue, computedValues);
    this.checkIntegrity(values);
    values.forEach((value, row) => {
      this.values[row][index] = value;
      this.valuesComputed[row][index] = computedValues[row] + 1;
      this.calcTrackingFeatures(value, this.values[row].length);
    });
  }

  computeAvg(index: number, values: readonly number[]): void {
    this.compute(index, (currValues, totalValues) =>
      currValues.map((curr, i) => (curr * totalValues[i] + values[i]) / (totalValues[i] + 1)),
    );
  }

  computeSum(index: number, values: readonly number[]): void {
    this.compute(index, (currValues) => currValues.map((curr, i) => curr + values[i]));
  }

  private checkIntegrity(values: readonly number[]): void {
    if (values.length !== this.values.length) {
      throw new Error(
        `Given values length ${values.length} should match with row number ${this.values.length} in this dataset`,
      );
    }
  }
}

/** Jeu de données d'événements ponctuels (recherches). */
export class TimeLineEventDataset extends BaseDataset {
  declare values: number[];
  events: TimeLineEvent[] = [];

  constructor(
    name: string,
    isLocalizeName: boolean,
    localizationDynamicValue: number | null,
    result: TimeLineResult,
    color: string | null,
  ) {
    super(name, isLocalizeName, localizationDynamicValue, result, color, 0);
    this.values = [1];
  }

  push(events: readonly TimeLineEvent[]): void {
    this.events.push(...events);
    this.values.push(1);
  }
}

export class TimeLineEvent {
  text: string;
  type: string;
  iconSrc: string;
  iconWidth: number;
  iconHeight: number;
  /** Position horizontale en tranches de timeline. */
  x: number;
  time: number;

  constructor(
    text: string,
    type: string,
    iconSrc: string,
    iconWidth: number,
    iconHeight: number,
    x: number,
    time: number,
  ) {
    this.text = text;
    this.type = type;
    this.iconSrc = iconSrc;
    this.iconWidth = iconWidth;
    this.iconHeight = iconHeight;
    this.x = x;
    this.time = time;
  }
}
