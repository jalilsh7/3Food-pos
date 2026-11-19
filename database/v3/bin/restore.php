<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
PosV3DatabaseTools::requireCli();
if(!extension_loaded('zlib'))throw new RuntimeException('PHP zlib extension is required.');
$archive=$argv[1]??'';
if($archive===''||!is_file($archive)||!is_readable($archive))throw new RuntimeException('Usage: php restore.php /secure/path/backup.jsonl.gz');
$pdo=PosV3DatabaseTools::connect();$lock=PosV3DatabaseTools::acquireLock($pdo);$gzip=null;
try{
 $objects=(int)$pdo->query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()')->fetchColumn();
 if($objects!==0)throw new RuntimeException("Restore stopped: destination database is not empty ({$objects} tables/views found). No objects were changed.");
 $gzip=gzopen($archive,'rb');if($gzip===false)throw new RuntimeException('Cannot open backup archive.');
 $readRecord=static function()use($gzip):?array{$line=gzgets($gzip);if($line===false)return null;$record=json_decode($line,true,512,JSON_THROW_ON_ERROR);if(!is_array($record)||!isset($record['type']))throw new RuntimeException('Backup archive contains an invalid record.');return $record;};
 $header=$readRecord();
 if(!$header||($header['type']??'')!=='header'||($header['format']??'')!=='persiacoder-pos-v3-jsonl-gzip'||($header['format_version']??0)!==1)throw new RuntimeException('Unsupported or invalid V3 backup format.');
 $serverVersion=(string)$pdo->query('SELECT VERSION()')->fetchColumn();$destinationEngine=stripos($serverVersion,'mariadb')!==false?'mariadb':'mysql';
 if(($header['engine']??'')!==$destinationEngine)throw new RuntimeException('Backup engine family differs from destination database.');
 $tables=[];$sawRows=false;
 while(($record=$readRecord())!==null){
  if(($record['type']??'')==='row'){$sawRows=true;continue;}
  if(($record['type']??'')!=='table'||$sawRows)throw new RuntimeException('Backup records are out of order or contain an unknown type.');
  $name=(string)($record['name']??'');$columns=$record['columns']??null;$createSql=$record['create_sql']??null;$rowCount=$record['row_count']??null;
  if(!preg_match('/^[A-Za-z0-9_]+$/',$name)||!is_array($columns)||!$columns||!is_string($createSql)||!is_int($rowCount)||$rowCount<0)throw new RuntimeException('Backup table descriptor is invalid.');
  if(isset($tables[$name]))throw new RuntimeException("Duplicate table descriptor: {$name}");
  foreach($columns as $column)if(!is_string($column)||!preg_match('/^[A-Za-z0-9_]+$/',$column))throw new RuntimeException("Invalid column name in {$name}.");
  if(!preg_match('/^CREATE TABLE\\s+`'.preg_quote($name,'/').'`/i',ltrim($createSql))||str_contains($createSql,';'))throw new RuntimeException("Invalid CREATE TABLE statement for {$name}.");
  $tables[$name]=['columns'=>$columns,'create_sql'=>$createSql,'expected_rows'=>$rowCount,'actual_rows'=>0,'insert'=>null];
 }
 if(count($tables)!==(int)($header['table_count']??0)||count($tables)<61)throw new RuntimeException('Backup table count does not match V3 baseline.');
 gzrewind($gzip);$readRecord();
 for($i=0;$i<count($tables);$i++)$readRecord();
 $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
 foreach($tables as $name=>$table)$pdo->exec($table['create_sql']);
 gzrewind($gzip);$readRecord();for($i=0;$i<count($tables);$i++)$readRecord();
 while(($record=$readRecord())!==null){
  if(($record['type']??'')!=='row')throw new RuntimeException('Unexpected non-row record in backup data section.');
  $name=(string)($record['table']??'');if(!isset($tables[$name]))throw new RuntimeException("Backup row references unknown table {$name}.");
  $values=$record['values']??null;if(!is_array($values)||count($values)!==count($tables[$name]['columns']))throw new RuntimeException("Backup row shape mismatch for {$name}.");
  if($tables[$name]['insert']===null){
   $columns=implode(',',array_map([PosV3DatabaseTools::class,'quoteIdentifier'],$tables[$name]['columns']));
   $placeholders=implode(',',array_fill(0,count($tables[$name]['columns']),'?'));
   $tables[$name]['insert']=$pdo->prepare('INSERT INTO '.PosV3DatabaseTools::quoteIdentifier($name).' ('.$columns.') VALUES ('.$placeholders.')');
  }
  $tables[$name]['insert']->execute($values);$tables[$name]['actual_rows']++;
 }
 foreach($tables as $name=>$table)if($table['actual_rows']!==$table['expected_rows'])throw new RuntimeException("Restored row count mismatch for {$name}.");
 $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
 $foreignKeys=$pdo->query("SELECT table_name,column_name,referenced_table_name,referenced_column_name,constraint_name,ordinal_position FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND referenced_table_name IS NOT NULL ORDER BY table_name,constraint_name,ordinal_position")->fetchAll();
 $groups=[];
 foreach($foreignKeys as $fk){$key=$fk['table_name'].'/'.$fk['constraint_name'];$groups[$key]['child']=$fk['table_name'];$groups[$key]['parent']=$fk['referenced_table_name'];$groups[$key]['pairs'][]=[$fk['column_name'],$fk['referenced_column_name']];}
 foreach($groups as $group){
  $child=$group['child'];$parent=$group['parent'];$conditions=[];$notNull=[];
  foreach($group['pairs'] as [$childColumn,$parentColumn]){$conditions[]='c.'.PosV3DatabaseTools::quoteIdentifier($childColumn).' = p.'.PosV3DatabaseTools::quoteIdentifier($parentColumn);$notNull[]='c.'.PosV3DatabaseTools::quoteIdentifier($childColumn).' IS NOT NULL';}
  $firstParent=$group['pairs'][0][1];
  $sql='SELECT COUNT(*) FROM '.PosV3DatabaseTools::quoteIdentifier($child).' c LEFT JOIN '.PosV3DatabaseTools::quoteIdentifier($parent).' p ON '.implode(' AND ',$conditions).' WHERE '.implode(' AND ',$notNull).' AND p.'.PosV3DatabaseTools::quoteIdentifier($firstParent).' IS NULL';
  $orphans=(int)$pdo->query($sql)->fetchColumn();if($orphans!==0)throw new RuntimeException("Foreign-key validation failed for {$child} -> {$parent}: {$orphans} orphan rows.");
 }
 echo "Restore completed: ".count($tables)." tables; all row counts and foreign keys verified.\n";
}catch(Throwable $error){try{$pdo->exec('SET FOREIGN_KEY_CHECKS=1');}catch(Throwable){}throw $error;}
finally{if(is_resource($gzip))gzclose($gzip);PosV3DatabaseTools::releaseLock($pdo,$lock);}
