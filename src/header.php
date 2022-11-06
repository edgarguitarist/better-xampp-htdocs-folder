<?php
// This function will take $_SERVER['REQUEST_URI'] and build a breadcrumb based on the user's current path

function breadcrumbs()
{
  // This gets the REQUEST_URI (/path/to/file.php), splits the string (using '/') into an array,
  // and then filters out any empty values
//print_r(parse_url($url)['query']);

  $path = array_filter(explode('/', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)));

  // This will build our "base URL" ... Also accounts for HTTPS :)
  $link = '';

  $breadcrumbs = ['']; //array("<a href=\"$base\">$home</a>");

  // Build the rest of the breadcrumbs
  foreach ($path as $key => $crumb) {
    // Our "title" is the text that will be displayed (strip out .php , '_' and bad format space '%20' into a space)
    $title = str_replace(array('.php', '_', '%20'), array('', ' ', ' '), $crumb);
    $link .= "/" . $crumb;
    // If we are not on the last index, then display an <a> tag
    if ($key != count($path)) {
      $breadcrumbs[] = "<a href=\"$link\">$title</a>";
    } else {
      $breadcrumbs[] = "<span>" . $title . "</span>";
    }
  }
  // Build our temporary array (pieces of bread) into one big string :)
  return implode('<span class="separador">/</span>', $breadcrumbs);
}

?>
<div class="header">

  <h1 class="breadcrumb"><a href="/">🏠 Index</a> <span>of /</span><?= breadcrumbs() ?></h1>
  <div class="functions">
    <div class="form">
      <?php include_once('search.php') ?>
    </div>
    <div class="buttons">
      <button id="darkMode" class="btn dark-mode-btn" title="Toggle DarkMode"></button>
      <button id="view" class="btn toggle-list" title="Grid">📅</button>
      <!--/📋 -->
    </div>
  </div>
</div>
<div class="table_container">