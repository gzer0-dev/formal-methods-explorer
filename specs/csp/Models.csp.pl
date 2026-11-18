:- dynamic parserVersionNum/1, parserVersionStr/1, parseResult/5.
:- dynamic module/4.
'parserVersionStr'('0.6.2.1').
'parseResult'('ok','',0,0,0).
:- dynamic channel/2, bindval/3, agent/3.
:- dynamic agent_curry/3, symbol/4.
:- dynamic dataTypeDef/2, subTypeDef/2, nameType/2.
:- dynamic cspTransparent/1.
:- dynamic cspPrint/1.
:- dynamic pragma/1.
:- dynamic comment/2.
:- dynamic assertBool/1, assertRef/5, assertTauPrio/6.
:- dynamic assertModelCheckExt/4, assertModelCheck/3.
:- dynamic assertLtl/4, assertCtl/4.
'parserVersionNum'([0,11,1,1]).
'parserVersionStr'('CSPM-Frontent-0.11.1.1').
'dataTypeDef'('Who',['constructor'('A'),'constructor'('B')]).
'bindval'('Vals','setExp'('rangeClosed'('int'(0),'int'(2))),'src_span'(6,1,6,14,186,13)).
'agent'('inc'(_x),'ifte'('<'(_x,'int'(2)),'+'(_x,'int'(1)),'int'(2),'no_loc_info_available','no_loc_info_available','no_loc_info_available'),'src_span'(7,10,7,36,209,26)).
'channel'('read','type'('dotTupleType'(['Who','val_of'('Vals','src_span'(9,27,9,31,263,4))]))).
'channel'('write','type'('dotTupleType'(['Who','val_of'('Vals','src_span'(9,27,9,31,263,4))]))).
'channel'('finish','type'('dotUnitType')).
'channel'('result','type'('dotTupleType'(['val_of'('Vals','src_span'(11,18,11,22,300,4))]))).
'channel'('lock','type'('dotTupleType'(['Who']))).
'channel'('unlock','type'('dotTupleType'(['Who']))).
'agent'('Var'(_x2),'[]'('[]'('repChoice'(['comprehensionGenerator'(_w,'Who')],'prefix'('src_span'(14,24,14,32,356,8),[],'dotTuple'(['read',_w,_x2]),'agent_call'('src_span'(14,36,14,39,368,3),'Var',[_x2]),'src_span'(14,33,14,35,364,18)),'src_span'(14,14,14,23,346,9)),'repChoice'(['comprehensionGenerator'(_w2,'Who')],'repChoice'(['comprehensionGenerator'(_y,'val_of'('Vals','src_span'(15,34,15,38,409,4)))],'prefix'('src_span'(15,41,15,50,416,9),[],'dotTuple'(['write',_w2,_y]),'agent_call'('src_span'(15,54,15,57,429,3),'Var',[_y]),'src_span'(15,51,15,53,425,19)),'src_span'(15,30,15,40,405,10)),'src_span'(15,17,15,26,392,9)),'src_span_operator'('no_loc_info_available','src_span'(15,10,15,12,385,2))),'prefix'('src_span'(16,13,16,19,449,6),[],'finish','prefix'('src_span'(16,23,16,31,459,8),[],'dotTuple'(['result',_x2]),'skip'('src_span'(16,35,16,39,471,4)),'src_span'(16,32,16,34,467,16)),'src_span'(16,20,16,22,455,26)),'src_span_operator'('no_loc_info_available','src_span'(16,10,16,12,446,2))),'no_loc_info_available').
'agent'('Adder'(_w3),'repChoice'(['comprehensionGenerator'(_x3,'val_of'('Vals','src_span'(18,19,18,23,495,4)))],'prefix'('src_span'(18,26,18,34,502,8),[],'dotTuple'(['read',_w3,_x3]),'prefix'('src_span'(18,38,18,52,514,14),[],'dotTuple'(['write',_w3,'agent_call'('src_span'(18,46,18,49,522,3),'inc',[_x3])]),'skip'('src_span'(18,56,18,60,532,4)),'src_span'(18,53,18,55,528,22)),'src_span'(18,35,18,37,510,34)),'src_span'(18,15,18,25,491,10)),'src_span'(18,12,18,60,488,48)).
'agent'('LockedAdder'(_w4),'prefix'('src_span'(19,18,19,24,554,6),[],'dotTuple'(['lock',_w4]),'repChoice'(['comprehensionGenerator'(_x4,'val_of'('Vals','src_span'(19,36,19,40,572,4)))],'prefix'('src_span'(19,43,19,51,579,8),[],'dotTuple'(['read',_w4,_x4]),'prefix'('src_span'(19,55,19,69,591,14),[],'dotTuple'(['write',_w4,'agent_call'('src_span'(19,63,19,66,599,3),'inc',[_x4])]),'prefix'('src_span'(19,73,19,81,609,8),[],'dotTuple'(['unlock',_w4]),'skip'('src_span'(19,85,19,89,621,4)),'src_span'(19,82,19,84,617,16)),'src_span'(19,70,19,72,605,34)),'src_span'(19,52,19,54,587,46)),'src_span'(19,32,19,42,568,10)),'src_span'(19,25,19,27,560,72)),'src_span'(19,18,19,90,554,72)).
'bindval'('Lock','[]'('repChoice'(['comprehensionGenerator'(_w5,'Who')],'prefix'('src_span'(20,22,20,28,648,6),[],'dotTuple'(['lock',_w5]),'prefix'('src_span'(20,32,20,40,658,8),[],'dotTuple'(['unlock',_w5]),'val_of'('Lock','src_span'(20,44,20,48,670,4)),'src_span'(20,41,20,43,666,16)),'src_span'(20,29,20,31,654,26)),'src_span'(20,12,20,21,638,9)),'prefix'('src_span'(20,53,20,59,679,6),[],'finish','skip'('src_span'(20,63,20,67,689,4)),'src_span'(20,60,20,62,685,14)),'src_span_operator'('no_loc_info_available','src_span'(20,50,20,52,676,2))),'src_span'(20,1,20,67,627,66)).
'bindval'('Naive','sharing'('closure'(['read','write','finish']),'agent_call'('src_span'(22,9,22,12,703,3),'Var',['int'(0)]),';'('|||'('agent_call'('src_span'(22,50,22,55,744,5),'Adder',['A']),'agent_call'('src_span'(22,63,22,68,757,5),'Adder',['B']),'src_span_operator'('no_loc_info_available','src_span'(22,59,22,62,753,3))),'prefix'('src_span'(22,75,22,81,769,6),[],'finish','skip'('src_span'(22,85,22,89,779,4)),'src_span'(22,82,22,84,775,14)),'src_span_operator'('no_loc_info_available','src_span'(22,73,22,74,767,1))),'src_span'(22,16,22,47,710,31)),'src_span'(22,1,22,90,695,89)).
'bindval'('Locked','sharing'('closure'(['lock','unlock','finish']),'sharing'('closure'(['read','write','finish']),'agent_call'('src_span'(23,11,23,14,795,3),'Var',['int'(0)]),';'('|||'('agent_call'('src_span'(23,52,23,63,836,11),'LockedAdder',['A']),'agent_call'('src_span'(23,71,23,82,855,11),'LockedAdder',['B']),'src_span_operator'('no_loc_info_available','src_span'(23,67,23,70,851,3))),'prefix'('src_span'(23,89,23,95,873,6),[],'finish','skip'('src_span'(23,99,23,103,883,4)),'src_span'(23,96,23,98,879,14)),'src_span_operator'('no_loc_info_available','src_span'(23,87,23,88,871,1))),'src_span'(23,18,23,49,802,31)),'val_of'('Lock','src_span'(24,43,24,47,932,4)),'src_span'(24,10,24,42,899,32)),'src_span'(23,1,24,47,785,151)).
'bindval'('NaiveObserved','\x5c\'('val_of'('Naive','src_span'(26,17,26,22,954,5)),'closure'(['read','write']),'src_span_operator'('no_loc_info_available','src_span'(26,23,26,24,960,1))),'src_span'(26,1,26,42,938,41)).
'bindval'('LockedObserved','\x5c\'('val_of'('Locked','src_span'(27,18,27,24,997,6)),'closure'(['read','write','lock','unlock']),'src_span_operator'('no_loc_info_available','src_span'(27,25,27,26,1004,1))),'src_span'(27,1,27,58,980,57)).
'bindval'('ResultSpec','prefix'('src_span'(28,14,28,20,1051,6),[],'finish','prefix'('src_span'(28,24,28,32,1061,8),[],'dotTuple'(['result','int'(2)]),'skip'('src_span'(28,36,28,40,1073,4)),'src_span'(28,33,28,35,1069,16)),'src_span'(28,21,28,23,1057,26)),'src_span'(28,1,28,40,1038,39)).
'channel'('mono','type'('dotUnitType')).
'channel'('color','type'('dotUnitType')).
'channel'('output','type'('dotUnitType')).
'bindval'('PrinterSpec','[]'('prefix'('src_span'(34,15,34,19,1197,4),[],'mono','prefix'('src_span'(34,23,34,29,1205,6),[],'output','val_of'('PrinterSpec','src_span'(34,33,34,44,1215,11)),'src_span'(34,30,34,32,1211,21)),'src_span'(34,20,34,22,1201,29)),'prefix'('src_span'(34,48,34,53,1230,5),[],'color','prefix'('src_span'(34,57,34,63,1239,6),[],'output','val_of'('PrinterSpec','src_span'(34,67,34,78,1249,11)),'src_span'(34,64,34,66,1245,21)),'src_span'(34,54,34,56,1235,30)),'src_span_operator'('no_loc_info_available','src_span'(34,45,34,47,1227,2))),'src_span'(34,1,34,78,1183,77)).
'bindval'('PrinterImpl','|~|'('[]'('prefix'('src_span'(35,16,35,20,1276,4),[],'mono','prefix'('src_span'(35,24,35,30,1284,6),[],'output','val_of'('PrinterImpl','src_span'(35,34,35,45,1294,11)),'src_span'(35,31,35,33,1290,21)),'src_span'(35,21,35,23,1280,29)),'prefix'('src_span'(35,49,35,54,1309,5),[],'color','prefix'('src_span'(35,58,35,64,1318,6),[],'output','val_of'('PrinterImpl','src_span'(35,68,35,79,1328,11)),'src_span'(35,65,35,67,1324,21)),'src_span'(35,55,35,57,1314,30)),'src_span_operator'('no_loc_info_available','src_span'(35,46,35,48,1306,2))),'prefix'('src_span'(36,20,36,24,1360,4),[],'mono','prefix'('src_span'(36,28,36,34,1368,6),[],'output','val_of'('PrinterImpl','src_span'(36,38,36,49,1378,11)),'src_span'(36,35,36,37,1374,21)),'src_span'(36,25,36,27,1364,29)),'src_span_operator'('no_loc_info_available','src_span'(36,15,36,18,1355,3))),'src_span'(35,1,36,50,1261,129)).
'channel'('pick','type'('dotTupleType'(['setExp'('rangeClosed'('int'(0),'int'(2))),'setExp'('rangeClosed'('int'(0),'int'(2)))]))).
'channel'('put','type'('dotTupleType'(['setExp'('rangeClosed'('int'(0),'int'(2))),'setExp'('rangeClosed'('int'(0),'int'(2)))]))).
'agent'('First'(_i,_n,_asym),'ifte'('bool_and'('=='(_asym,'int'(1)),'=='(_i,'-'(_n,'int'(1)))),'%'('+'(_i,'int'(1)),_n),_i,'no_loc_info_available','no_loc_info_available','no_loc_info_available'),'src_span'(41,21,41,72,1497,51)).
'agent'('Second'(_i2,_n2,_asym2),'ifte'('bool_and'('=='(_asym2,'int'(1)),'=='(_i2,'-'(_n2,'int'(1)))),_i2,'%'('+'(_i2,'int'(1)),_n2),'no_loc_info_available','no_loc_info_available','no_loc_info_available'),'src_span'(42,22,42,73,1570,51)).
'agent'('Phil'(_i3,_n3,_asym3),'prefix'('src_span'(43,20,43,44,1641,24),[],'dotTuple'(['pick',_i3,'agent_call'('src_span'(43,27,43,32,1648,5),'First',[_i3,_n3,_asym3])]),'prefix'('src_span'(43,48,43,73,1669,25),[],'dotTuple'(['pick',_i3,'agent_call'('src_span'(43,55,43,61,1676,6),'Second',[_i3,_n3,_asym3])]),'prefix'('src_span'(44,23,44,47,1717,24),[],'dotTuple'(['put',_i3,'agent_call'('src_span'(44,29,44,35,1723,6),'Second',[_i3,_n3,_asym3])]),'prefix'('src_span'(44,51,44,74,1745,23),[],'dotTuple'(['put',_i3,'agent_call'('src_span'(44,57,44,62,1751,5),'First',[_i3,_n3,_asym3])]),'agent_call'('src_span'(44,78,44,82,1772,4),'Phil',[_i3,_n3,_asym3]),'src_span'(44,75,44,77,1768,43)),'src_span'(44,48,44,50,1741,71)),'src_span'(43,74,44,22,1694,119)),'src_span'(43,45,43,47,1665,147)),'src_span'(43,20,44,94,1641,147)).
'agent'('Fork'(_j,_n4),'repChoice'(['comprehensionGenerator'(_i4,'setExp'('rangeEnum'([_j,'%'('+'('-'(_j,'int'(1)),_n4),_n4)])))],'prefix'('src_span'(45,44,45,52,1832,8),[],'dotTuple'(['pick',_i4,_j]),'prefix'('src_span'(45,56,45,63,1844,7),[],'dotTuple'(['put',_i4,_j]),'agent_call'('src_span'(45,67,45,71,1855,4),'Fork',[_j,_n4]),'src_span'(45,64,45,66,1851,21)),'src_span'(45,53,45,55,1840,33)),'src_span'(45,17,45,43,1805,26)),'src_span'(45,14,45,77,1802,63)).
'agent'('Dining'(_n5,_asym4),'sharing'('closure'(['pick','put']),'repInterleave'(['comprehensionGenerator'(_i5,'setExp'('rangeClosed'('int'(0),'-'(_n5,'int'(1)))))],'agent_call'('src_span'(46,39,46,43,1904,4),'Phil',[_i5,_n5,_asym4]),'src_span'(46,24,46,38,1889,14)),'repInterleave'(['comprehensionGenerator'(_j2,'setExp'('rangeClosed'('int'(0),'-'(_n5,'int'(1)))))],'agent_call'('src_span'(46,99,46,103,1964,4),'Fork',[_j2,_n5]),'src_span'(46,84,46,98,1949,14)),'src_span'(46,57,46,78,1922,21)),'src_span'(46,57,46,78,1922,21)).
'bindval'('Dining2','agent_call'('src_span'(48,11,48,17,1987,6),'Dining',['int'(2),'int'(0)]),'src_span'(48,1,48,23,1977,22)).
'bindval'('Dining2Fixed','agent_call'('src_span'(49,16,49,22,2015,6),'Dining',['int'(2),'int'(1)]),'src_span'(49,1,49,28,2000,27)).
'bindval'('Dining3','agent_call'('src_span'(50,11,50,17,2038,6),'Dining',['int'(3),'int'(0)]),'src_span'(50,1,50,23,2028,22)).
'bindval'('Dining3Fixed','agent_call'('src_span'(51,16,51,22,2066,6),'Dining',['int'(3),'int'(1)]),'src_span'(51,1,51,28,2051,27)).
'channel'('start','type'('dotUnitType')).
'channel'('succeed','type'('dotUnitType')).
'channel'('fail','type'('dotUnitType')).
'channel'('giveup','type'('dotUnitType')).
'agent'('Job'(_k),'prefix'('src_span'(56,10,56,15,2170,5),[],'start','[]'('prefix'('src_span'(56,20,56,27,2180,7),[],'succeed','skip'('src_span'(56,31,56,35,2191,4)),'src_span'(56,28,56,30,2187,15)),'ifte'('=='(_k,'int'(0)),'prefix'('src_span'(57,39,57,45,2234,6),[],'giveup','skip'('src_span'(57,49,57,53,2244,4)),'src_span'(57,46,57,48,2240,14)),'prefix'('src_span'(57,59,57,63,2254,4),[],'fail','agent_call'('src_span'(57,67,57,70,2262,3),'Job',['ifte'('<'(_k,'int'(0)),'int'(-1),'-'(_k,'int'(1)),'no_loc_info_available','no_loc_info_available','no_loc_info_available')]),'src_span'(57,64,57,66,2258,40)),'no_loc_info_available','no_loc_info_available','src_span'(57,54,57,58,2248,60)),'src_span_operator'('no_loc_info_available','src_span'(57,20,57,22,2215,2))),'src_span'(56,16,56,18,2175,126)),'src_span'(56,10,57,101,2170,126)).
'bindval'('JobUnlimited','agent_call'('src_span'(58,16,58,19,2312,3),'Job',['int'(-1)]),'src_span'(58,1,58,23,2297,22)).
'bindval'('JobUnlimitedHidden','\x5c\'('agent_call'('src_span'(59,22,59,25,2341,3),'Job',['int'(-1)]),'setExp'('rangeEnum'(['start','fail'])),'src_span_operator'('no_loc_info_available','src_span'(59,30,59,31,2349,1))),'src_span'(59,1,59,45,2320,44)).
'bindval'('JobLimitedHidden','\x5c\'('agent_call'('src_span'(60,20,60,23,2384,3),'Job',['int'(2)]),'setExp'('rangeEnum'(['start','fail'])),'src_span_operator'('no_loc_info_available','src_span'(60,27,60,28,2391,1))),'src_span'(60,1,60,42,2365,41)).
'comment'('lineComment'('-- \x30b5\\x30a4\\x30c8\\x306e\ CSP \x306e\\x30ec\\x30c3\\x30b9\\x30f3\\xff08\src/topic/cspModels.ts\xff09\\x3068\\x540c\\x3058\\x30e2\\x30c7\\x30eb\\x3092\ CSPM \x3067\\x66f8\\x3044\\x305f\\x3082\\x306e\\x3002\'),'src_position'(1,1,0,61)).
'comment'('lineComment'('-- ProB\xff08\probcli\xff09\\x3067\\x8a73\\x7d30\\x5316\\x30fb\\x30c7\\x30c3\\x30c9\\x30ed\\x30c3\\x30af\\x30fb\\x767a\\x6563\\x3092\\x8abf\\x3079\\x3001\\x30b5\\x30a4\\x30c8\\x306e\\x81ea\\x4f5c\\x306e\\x691c\\x67fb\\x5668\\x306e\\x7d50\\x679c\\x3068\\x7167\\x5408\\x3059\\x308b\\xff08\check-prob.mjs\xff09\\x3002\'),'src_position'(2,1,62,69)).
'comment'('lineComment'('-- ---- \x30ab\\x30a6\\x30f3\\x30bf\: \x5171\\x6709\\x5909\\x6570\\x3092\\x30d7\\x30ed\\x30bb\\x30b9\\x3067\\x66f8\\x304f\ ----'),'src_position'(4,1,133,31)).
'comment'('lineComment'('-- ---- \x30d7\\x30ea\\x30f3\\x30bf\: \x5916\\x90e8\\x9078\\x629e\\x3068\\x5185\\x90e8\\x9078\\x629e\ ----'),'src_position'(30,1,1079,28)).
'comment'('lineComment'('-- \x30b5\\x30a4\\x30c8\\x306e\ print \x306f\ CSPM \x306e\\x4e88\\x7d04\\x8a9e\\x306a\\x306e\\x3067\\x3001\\x3053\\x3053\\x3067\\x306f\ output \x3068\\x66f8\\x304f\\x3002\'),'src_position'(31,1,1108,45)).
'comment'('lineComment'('-- ---- \x98df\\x4e8b\\x3059\\x308b\\x54f2\\x5b66\\x8005\\xff08\n \x4eba\\x3001\asym = 1 \x306a\\x3089\\x6700\\x5f8c\\x306e\1\x4eba\\x3060\\x3051\\x53f3\\x304b\\x3089\\x53d6\\x308b\\xff09\ ----'),'src_position'(38,1,1392,49)).
'comment'('lineComment'('-- ---- \x30ea\\x30c8\\x30e9\\x30a4\\x3059\\x308b\\x30b8\\x30e7\\x30d6\\xff08\retries = -1 \x306a\\x3089\\x7121\\x5236\\x9650\\xff09\ ----'),'src_position'(53,1,2080,42)).
'symbol'('Who','Who','src_span'(5,10,5,13,174,3),'Datatype').
'symbol'('A','A','src_span'(5,16,5,17,180,1),'Constructor of Datatype').
'symbol'('B','B','src_span'(5,20,5,21,184,1),'Constructor of Datatype').
'symbol'('Vals','Vals','src_span'(6,1,6,5,186,4),'Ident (Groundrep.)').
'symbol'('inc','inc','src_span'(7,1,7,4,200,3),'Funktion or Process').
'symbol'('x','x','src_span'(7,5,7,6,204,1),'Ident (Prolog Variable)').
'symbol'('read','read','src_span'(9,9,9,13,245,4),'Channel').
'symbol'('write','write','src_span'(9,15,9,20,251,5),'Channel').
'symbol'('finish','finish','src_span'(10,9,10,15,276,6),'Channel').
'symbol'('result','result','src_span'(11,9,11,15,291,6),'Channel').
'symbol'('lock','lock','src_span'(12,9,12,13,313,4),'Channel').
'symbol'('unlock','unlock','src_span'(12,15,12,21,319,6),'Channel').
'symbol'('Var','Var','src_span'(14,1,14,4,333,3),'Funktion or Process').
'symbol'('x2','x','src_span'(14,5,14,6,337,1),'Ident (Prolog Variable)').
'symbol'('w','w','src_span'(14,14,14,15,346,1),'Ident (Prolog Variable)').
'symbol'('w2','w','src_span'(15,17,15,18,392,1),'Ident (Prolog Variable)').
'symbol'('y','y','src_span'(15,30,15,31,405,1),'Ident (Prolog Variable)').
'symbol'('Adder','Adder','src_span'(18,1,18,6,477,5),'Funktion or Process').
'symbol'('w3','w','src_span'(18,7,18,8,483,1),'Ident (Prolog Variable)').
'symbol'('x3','x','src_span'(18,15,18,16,491,1),'Ident (Prolog Variable)').
'symbol'('LockedAdder','LockedAdder','src_span'(19,1,19,12,537,11),'Funktion or Process').
'symbol'('w4','w','src_span'(19,13,19,14,549,1),'Ident (Prolog Variable)').
'symbol'('x4','x','src_span'(19,32,19,33,568,1),'Ident (Prolog Variable)').
'symbol'('Lock','Lock','src_span'(20,1,20,5,627,4),'Ident (Groundrep.)').
'symbol'('w5','w','src_span'(20,12,20,13,638,1),'Ident (Prolog Variable)').
'symbol'('Naive','Naive','src_span'(22,1,22,6,695,5),'Ident (Groundrep.)').
'symbol'('Locked','Locked','src_span'(23,1,23,7,785,6),'Ident (Groundrep.)').
'symbol'('NaiveObserved','NaiveObserved','src_span'(26,1,26,14,938,13),'Ident (Groundrep.)').
'symbol'('LockedObserved','LockedObserved','src_span'(27,1,27,15,980,14),'Ident (Groundrep.)').
'symbol'('ResultSpec','ResultSpec','src_span'(28,1,28,11,1038,10),'Ident (Groundrep.)').
'symbol'('mono','mono','src_span'(32,9,32,13,1162,4),'Channel').
'symbol'('color','color','src_span'(32,15,32,20,1168,5),'Channel').
'symbol'('output','output','src_span'(32,22,32,28,1175,6),'Channel').
'symbol'('PrinterSpec','PrinterSpec','src_span'(34,1,34,12,1183,11),'Ident (Groundrep.)').
'symbol'('PrinterImpl','PrinterImpl','src_span'(35,1,35,12,1261,11),'Ident (Groundrep.)').
'symbol'('pick','pick','src_span'(39,9,39,13,1450,4),'Channel').
'symbol'('put','put','src_span'(39,15,39,18,1456,3),'Channel').
'symbol'('First','First','src_span'(41,1,41,6,1477,5),'Funktion or Process').
'symbol'('i','i','src_span'(41,7,41,8,1483,1),'Ident (Prolog Variable)').
'symbol'('n','n','src_span'(41,10,41,11,1486,1),'Ident (Prolog Variable)').
'symbol'('asym','asym','src_span'(41,13,41,17,1489,4),'Ident (Prolog Variable)').
'symbol'('Second','Second','src_span'(42,1,42,7,1549,6),'Funktion or Process').
'symbol'('i2','i','src_span'(42,8,42,9,1556,1),'Ident (Prolog Variable)').
'symbol'('n2','n','src_span'(42,11,42,12,1559,1),'Ident (Prolog Variable)').
'symbol'('asym2','asym','src_span'(42,14,42,18,1562,4),'Ident (Prolog Variable)').
'symbol'('Phil','Phil','src_span'(43,1,43,5,1622,4),'Funktion or Process').
'symbol'('i3','i','src_span'(43,6,43,7,1627,1),'Ident (Prolog Variable)').
'symbol'('n3','n','src_span'(43,9,43,10,1630,1),'Ident (Prolog Variable)').
'symbol'('asym3','asym','src_span'(43,12,43,16,1633,4),'Ident (Prolog Variable)').
'symbol'('Fork','Fork','src_span'(45,1,45,5,1789,4),'Funktion or Process').
'symbol'('j','j','src_span'(45,6,45,7,1794,1),'Ident (Prolog Variable)').
'symbol'('n4','n','src_span'(45,9,45,10,1797,1),'Ident (Prolog Variable)').
'symbol'('i4','i','src_span'(45,17,45,18,1805,1),'Ident (Prolog Variable)').
'symbol'('Dining','Dining','src_span'(46,1,46,7,1866,6),'Funktion or Process').
'symbol'('n5','n','src_span'(46,8,46,9,1873,1),'Ident (Prolog Variable)').
'symbol'('asym4','asym','src_span'(46,11,46,15,1876,4),'Ident (Prolog Variable)').
'symbol'('i5','i','src_span'(46,24,46,25,1889,1),'Ident (Prolog Variable)').
'symbol'('j2','j','src_span'(46,84,46,85,1949,1),'Ident (Prolog Variable)').
'symbol'('Dining2','Dining2','src_span'(48,1,48,8,1977,7),'Ident (Groundrep.)').
'symbol'('Dining2Fixed','Dining2Fixed','src_span'(49,1,49,13,2000,12),'Ident (Groundrep.)').
'symbol'('Dining3','Dining3','src_span'(50,1,50,8,2028,7),'Ident (Groundrep.)').
'symbol'('Dining3Fixed','Dining3Fixed','src_span'(51,1,51,13,2051,12),'Ident (Groundrep.)').
'symbol'('start','start','src_span'(54,9,54,14,2131,5),'Channel').
'symbol'('succeed','succeed','src_span'(54,16,54,23,2138,7),'Channel').
'symbol'('fail','fail','src_span'(54,25,54,29,2147,4),'Channel').
'symbol'('giveup','giveup','src_span'(54,31,54,37,2153,6),'Channel').
'symbol'('Job','Job','src_span'(56,1,56,4,2161,3),'Funktion or Process').
'symbol'('k','k','src_span'(56,5,56,6,2165,1),'Ident (Prolog Variable)').
'symbol'('JobUnlimited','JobUnlimited','src_span'(58,1,58,13,2297,12),'Ident (Groundrep.)').
'symbol'('JobUnlimitedHidden','JobUnlimitedHidden','src_span'(59,1,59,19,2320,18),'Ident (Groundrep.)').
'symbol'('JobLimitedHidden','JobLimitedHidden','src_span'(60,1,60,17,2365,16),'Ident (Groundrep.)').