<?php
$url = "https://testurl.com/test/1234?email=abc@test.com&name=sarah";
$components = parse_url($url);
print_r($components);
?><br><?php
print_r(parse_url($url)['query']);
?><br><?php
parse_str(parse_url($url)['query'], $params);
print_r($params);
?><br><?php
foreach($params as $param => $value){
    
};