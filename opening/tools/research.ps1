$ErrorActionPreference = 'Stop'
$dataDir = Join-Path $PSScriptRoot '../data'
$seeds = Get-Content -Raw (Join-Path $dataDir 'seeds.json') | ConvertFrom-Json
$ids = ($seeds | ForEach-Object { $_[2] }) -join ','
$query = 'query { Page(perPage: 50) { media(type: ANIME, idMal_in: [' + $ids + ']) { id idMal title { romaji english } coverImage { large extraLarge } genres siteUrl } } }'
$metadata = Invoke-RestMethod -Method Post -Uri 'https://graphql.anilist.co' -ContentType 'application/json' -Body (@{query=$query} | ConvertTo-Json -Compress) -TimeoutSec 20
$metadata.data.Page.media | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 (Join-Path $dataDir 'anime-metadata.json')
$results = $seeds | ForEach-Object -Parallel {
    $seed = $_
    $key, $ru, $mal, $title, $artist, $pinned, $distractors = $seed
    $rows = @{}
    $errors = @()
    if ($pinned) {
        try {
            $track = Invoke-RestMethod -Uri ('https://api.deezer.com/track/' + $pinned) -TimeoutSec 12
            $rows[[string]$track.id] = $track
        } catch { $errors += $_.Exception.Message }
    } else {
        foreach ($term in @("$artist $title", $title, $artist)) {
            try {
                $url = 'https://api.deezer.com/search?limit=100&q=' + [uri]::EscapeDataString($term)
                $found = Invoke-RestMethod -Uri $url -TimeoutSec 12
                foreach ($track in $found.data) {
                    $a = $artist.ToLower() -replace '[^\p{L}\p{N}]',''
                    $b = $track.artist.name.ToLower() -replace '[^\p{L}\p{N}]',''
                    if (($a.Contains($b) -or $b.Contains($a)) -and $track.preview -and $track.title -notmatch 'cover|karaoke|instrumental|live|remix|sped|slowed|piano') {
                        $rows[[string]$track.id] = $track
                    }
                }
                $normalized = $title.ToLower() -replace '[^\p{L}\p{N}]',''
                $exact = @($rows.Values | Where-Object { ($_.title.ToLower() -replace '[^\p{L}\p{N}]','') -eq $normalized })
                if ($exact.Count) { break }
            } catch { $errors += $_.Exception.Message }
        }
    }
    [pscustomobject]@{ key=$key; tracks=@($rows.Values | Sort-Object rank -Descending); errors=$errors }
} -ThrottleLimit 5
$results | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 (Join-Path $dataDir 'recording-candidates.json')
foreach ($seed in $seeds) {
    $item = $results | Where-Object key -eq $seed[0]
    $norm = $seed[3].ToLower() -replace '[^\p{L}\p{N}]',''
    $exact = @($item.tracks | Where-Object { ($_.title.ToLower() -replace '[^\p{L}\p{N}]','') -eq $norm })
    $selected = if ($exact.Count) { $exact } else { @($item.tracks | Select-Object -First 7) }
    Write-Output ($seed[0] + ': ' + (($selected | ForEach-Object { "$($_.id) $($_.title) [$($_.artist.name)]" }) -join ' | '))
}
