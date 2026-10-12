// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { chartNameExists, importChart, loadCharts, readChart, saveCharts, serializeChart, uniqueChartName } from './storage';
import { exampleProject } from './model';
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks();});
it('saves and restores diagrams without touching compiler projects',()=>{localStorage.setItem('pico.projects.v1','untouched');const p=exampleProject('counter');saveCharts({projects:[p],activeId:p.id});expect(loadCharts()).toEqual({projects:[p],activeId:p.id});expect(localStorage.getItem('pico.projects.v1')).toBe('untouched');});
it('imports an editable chart with a fresh project identity',()=>{const p=exampleProject('largest'),copy=importChart(serializeChart(p));expect(copy.id).not.toBe(p.id);expect(copy.nodes).toEqual(p.nodes);expect(copy.edges).toEqual(p.edges);});
it('normalizes workspace names and prevents duplicate names',()=>{const p=exampleProject();p.name='My Chart';expect(chartNameExists(' my   chart ',[p])).toBe(true);expect(uniqueChartName('my chart',[p])).toBe('my chart (2)');expect(chartNameExists('My Chart',[p],p.id)).toBe(false);});
it('recovers valid projects from a partially corrupted store',()=>{const p=exampleProject();localStorage.setItem('pico.flowcharts.v1',JSON.stringify({version:1,projects:[{bad:true},p],activeId:'missing'}));expect(loadCharts().projects).toEqual([p]);expect(loadCharts().activeId).toBe(p.id);});
it('rejects invalid coordinates, duplicate blocks, and foreign files',()=>{const p=exampleProject();expect(()=>readChart({...p,nodes:[{...p.nodes[0],x:Infinity}]})).toThrow();expect(()=>readChart({...p,nodes:[p.nodes[0],p.nodes[0]]})).toThrow();expect(()=>importChart('{"format":"pico","version":1}')).toThrow(/picochart/);});
it('loads a usable chart when local storage is blocked',()=>{vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});expect(loadCharts().projects[0].nodes[0].kind).toBe('start');});
