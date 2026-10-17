"""Value-only Catalog v1 projection. Unknown region/mode remain explicit."""
import re

def difficulty_to_tja_course(difficulty):
    if type(difficulty) is not int or not 1 <= difficulty <= 5:
        raise ValueError('Invalid difficulty')
    return difficulty - 1


def project_catalog(rows, revision):
    if not isinstance(rows, list) or len(rows) > 10000:
        raise ValueError('Invalid catalog')
    songs, charts, seen = [], [], set()
    for row in rows:
        value = row.get('id')
        if type(value) not in (int,str) or not re.fullmatch(r'[1-9][0-9]*',str(value)):
            raise ValueError('Invalid song ID')
        try:
            number = float(value)
            if not number.is_integer() or not 0 < number <= 9007199254740991:
                raise ValueError('Invalid song ID')
        except (TypeError, ValueError):
            raise ValueError('Invalid song ID') from None
        # Canonical numeric source IDs; no title-based merging.
        song_id = str(value)
        if song_id in seen:
            raise ValueError('Ambiguous catalog')
        seen.add(song_id)
        region = row.get('region') if row.get('region') in ('CN', 'JP') else 'UNKNOWN'
        raw_status = row.get('shelf_status')
        status = 'active' if type(raw_status) in (str, int) and raw_status in (0, '0') else 'removed' if type(raw_status) in (str, int) and raw_status in (1, '1') else 'unknown'
        availability = dict(region=region, status=status)
        title = row.get('song_name')
        songs.append(dict(songId=song_id, title=title[:512] if isinstance(title,str) else None, catalogRevision=revision, availability=availability))
        mode = row.get('chart_type') if row.get('chart_type') in ('single', 'double') else 'unknown'
        for difficulty in range(1,6):
            value = row.get('level_'+str(difficulty))
            if value in (None,'','-'):
                continue
            try:
                level = float(value)
            except (ValueError,TypeError):
                continue
            if not 0 < level < float('inf'):
                continue
            charts.append(dict(songId=song_id,chartId=f'{song_id}:{difficulty}:{mode}',difficulty=difficulty,level=level,type=mode,variant=None,catalogRevision=revision,availability=availability,tjaCourse=difficulty_to_tja_course(difficulty)))
    return dict(songs=sorted(songs,key=lambda x:int(x['songId'])),charts=sorted(charts,key=lambda x:(int(x['songId']),x['difficulty'])))
