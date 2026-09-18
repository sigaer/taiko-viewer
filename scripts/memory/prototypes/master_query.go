// Read-only master-data query PoC. No network, bot imports or production writes.
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

func pss() int64 {
	f, e := os.Open("/proc/self/smaps_rollup")
	if e != nil {
		panic(e)
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		if strings.HasPrefix(s.Text(), "Pss:") {
			v, _ := strconv.ParseInt(strings.Fields(s.Text())[1], 10, 64)
			return v
		}
	}
	return 0
}
func main() {
	start := time.Now()
	base := pss()
	f, e := os.Open(os.Args[1])
	if e != nil {
		panic(e)
	}
	d := json.NewDecoder(f)
	if _, e = d.Token(); e != nil {
		panic(e)
	}
	index := map[int64]json.RawMessage{}
	for d.More() {
		var raw json.RawMessage
		if e = d.Decode(&raw); e != nil {
			panic(e)
		}
		var id struct {
			ID int64 `json:"id"`
		}
		if e = json.Unmarshal(raw, &id); e != nil {
			panic(e)
		}
		index[id.ID] = raw
	}
	f.Close()
	runtime.GC()
	resident := pss()
	startup := time.Since(start).Seconds()
	ids := make([]int64, 0, len(index))
	for id := range index {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	step := len(ids) / 100
	if step < 1 {
		step = 1
	}
	keys := []int64{}
	for i := 0; i < len(ids) && len(keys) < 100; i += step {
		keys = append(keys, ids[i])
	}
	query := func(id int64) map[string]any {
		var row map[string]any
		if e := json.Unmarshal(index[id], &row); e != nil {
			panic(e)
		}
		return row
	}
	sample := make([]map[string]any, len(keys))
	for i, k := range keys {
		sample[i] = query(k)
	}
	out, e := os.Create(os.Args[2])
	if e != nil {
		panic(e)
	}
	json.NewEncoder(out).Encode(sample)
	out.Close()
	lat := make([]int64, 10000)
	start = time.Now()
	sum := 0
	for i := range lat {
		t := time.Now()
		row := query(keys[i%len(keys)])
		lat[i] = time.Since(t).Nanoseconds()
		sum += len(row)
	}
	elapsed := time.Since(start).Seconds()
	sort.Slice(lat, func(i, j int) bool { return lat[i] < lat[j] })
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("{\"mode\":\"go_raw_index\",\"pss_kib\":%d,\"base_pss_kib\":%d,\"startup_seconds\":%g,\"qps\":%g,\"lookup_p50_us\":%g,\"lookup_p95_us\":%g,\"heap_alloc_bytes\":%d,\"checksum_count\":%d}\n", resident, base, startup, 10000/elapsed, float64(lat[5000])/1000, float64(lat[9500])/1000, m.HeapAlloc, sum)
}
