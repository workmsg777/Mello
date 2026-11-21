"""Run existing AI tests and save one honest result per unittest case."""
import json
from pathlib import Path
import sys
from datetime import datetime, timezone
import unittest

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
sys.path.insert(0,str(PROJECT/'ai'))

class RecordingResult(unittest.TextTestResult):
    def startTest(self,test):
        super().startTest(test)
        self.started=datetime.now(timezone.utc)
    def record(self,test,status,detail=''):
        self.records.append({'name':test.id(),'status':status,'detail':detail,'at':datetime.now(timezone.utc).isoformat(),'durationMs':round((datetime.now(timezone.utc)-self.started).total_seconds()*1000)})
    def addSuccess(self,test):super().addSuccess(test);self.record(test,'PASS')
    def addFailure(self,test,err):super().addFailure(test,err);self.record(test,'FAIL',self._exc_info_to_string(err,test))
    def addError(self,test,err):super().addError(test,err);self.record(test,'FAIL',self._exc_info_to_string(err,test))
    def addSkip(self,test,reason):super().addSkip(test,reason);self.record(test,'BLOCKED',reason)
    def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);self.records=[]

suite=unittest.defaultTestLoader.discover(str(PROJECT/'ai/tests'))
result=unittest.TextTestRunner(verbosity=2,resultclass=RecordingResult).run(suite)
(ROOT/'results').mkdir(exist_ok=True)
(ROOT/'results/python.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'tests':result.records},indent=2),encoding='utf-8')
raise SystemExit(0 if result.wasSuccessful() else 1)
